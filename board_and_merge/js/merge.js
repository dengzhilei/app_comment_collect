/**
 * Board & Merge - merge grid, 3 generators, drag to merge
 */
(function(global) {
  var ROWS = typeof MERGE_GRID_ROWS !== 'undefined' ? MERGE_GRID_ROWS : 5;
  var COLS = typeof MERGE_GRID_COLS !== 'undefined' ? MERGE_GRID_COLS : 5;
  var COST = typeof MERGE_SPAWN_ENERGY_COST !== 'undefined' ? MERGE_SPAWN_ENERGY_COST : 3;
  var ADVANCED_PROB = typeof MERGE_SPAWN_ADVANCED_PROB !== 'undefined' ? MERGE_SPAWN_ADVANCED_PROB : 0.2;
  var _draggedCellIndex = null;
  var _draggedNode = null;

  function showLuckyFloat() {
    var section = document.querySelector('.merge-section');
    if (!section) return;
    var wrap = section.querySelector('.lucky-float-wrap') || (function() {
      var w = document.createElement('div');
      w.className = 'lucky-float-wrap';
      w.style.cssText = 'position:absolute;left:0;right:0;top:0;bottom:0;pointer-events:none;overflow:hidden;';
      section.style.position = 'relative';
      section.appendChild(w);
      return w;
    })();
    var el = document.createElement('div');
    el.className = 'lucky-float';
    el.textContent = 'Lucky';
    wrap.appendChild(el);
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 1600);
  }

  function getGrid() {
    return state.mergeGrid || [];
  }

  function indexToPos(i) {
    return { row: Math.floor(i / COLS), col: i % COLS };
  }

  function posToIndex(r, c) {
    return r * COLS + c;
  }

  function emptyCellIndex() {
    var grid = getGrid();
    for (var i = 0; i < grid.length; i++) {
      if (!grid[i]) return i;
    }
    return -1;
  }

  function spawnFromGenerator(chainKey) {
    var chain = CHAINS[chainKey];
    if (!chain || !chain[0]) return;
    var baseId = chain[0].id;
    if ((state.energy || 0) < COST) {
      if (typeof showToast === 'function') showToast('Need ' + COST + ' energy');
      return;
    }
    var idx = emptyCellIndex();
    if (idx < 0) {
      if (typeof showToast === 'function') showToast('Grid full');
      return;
    }
    state.energy -= COST;
    var spawnId = baseId;
    var maxLevel = typeof getMaxChainLevel === 'function' ? getMaxChainLevel(chainKey) : 1;
    if (maxLevel >= 2 && Math.random() < ADVANCED_PROB) {
      var level = 2 + Math.floor(Math.random() * (maxLevel - 1));
      if (level > 0 && chain[level - 1]) spawnId = chain[level - 1].id;
      showLuckyFloat();
    }
    state.mergeGrid[idx] = { id: spawnId };
    if (typeof updateEnergyUI === 'function') updateEnergyUI();
    renderMergeGrid();
    if (typeof renderTownMap === 'function') renderTownMap();
  }

  function tryMerge(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    var grid = getGrid();
    var fromCell = grid[fromIndex];
    var toCell = grid[toIndex];
    if (!fromCell || !toCell || fromCell.id !== toCell.id) return;
    var nextId = typeof getMergeResult === 'function' ? getMergeResult(fromCell.id) : null;
    if (!nextId) return;
    if (!isChainItemUnlocked(nextId)) return;
    grid[fromIndex] = null;
    grid[toIndex] = { id: nextId };
    renderMergeGrid();
    if (typeof renderTownMap === 'function') renderTownMap();
    if (typeof showToast === 'function') showToast('Merged!');
  }

  function getOrderItemIds() {
    var ids = {};
    (state.activeOrders || []).forEach(function(slot) {
      (slot.order && slot.order.items || []).forEach(function(need) { ids[need.id] = true; });
    });
    return ids;
  }

  function renderMergeGrid() {
    var container = document.getElementById('merge-grid');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(' + COLS + ', 1fr)';
    container.style.gridTemplateRows = 'repeat(' + ROWS + ', 1fr)';
    var grid = getGrid();
    var orderItemIds = getOrderItemIds();
    for (var i = 0; i < grid.length; i++) {
      var cell = document.createElement('div');
      cell.className = 'merge-cell';
      cell.dataset.index = i;
      cell.draggable = true;
      if (grid[i]) {
        var info = getItemInfo(grid[i].id);
        if (info.img) {
          var img = document.createElement('img');
          img.className = 'merge-cell-img';
          img.src = info.img;
          img.alt = info.name;
          img.draggable = false;
          img.onerror = function() { this.style.display = 'none'; this.nextElementSibling && (this.nextElementSibling.style.display = ''); };
          cell.appendChild(img);
          var fallback = document.createElement('span');
          fallback.className = 'merge-cell-emoji';
          fallback.textContent = info.emoji || '';
          fallback.style.display = 'none';
          cell.appendChild(fallback);
        } else {
          cell.innerHTML = '<span class="merge-cell-emoji">' + (info.emoji || '') + '</span>';
        }
        if (orderItemIds[grid[i].id]) {
          var check = document.createElement('span');
          check.className = 'merge-cell-order-check';
          check.textContent = '\u2713';
          check.setAttribute('aria-hidden', 'true');
          cell.appendChild(check);
        }
        cell.classList.add('filled');
      }
      cell.addEventListener('dragstart', function(ev) {
        var idx = parseInt(this.dataset.index, 10);
        if (!grid[idx]) return;
        _draggedCellIndex = idx;
        _draggedNode = this;
        ev.dataTransfer.setData('text/plain', idx);
        ev.dataTransfer.effectAllowed = 'move';
        this.classList.add('dragging');
      });
      cell.addEventListener('dragend', function() {
        this.classList.remove('dragging');
        _draggedCellIndex = null;
        _draggedNode = null;
      });
      cell.addEventListener('dragover', function(ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
      });
      cell.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
      });
      cell.addEventListener('drop', function(ev) {
        ev.preventDefault();
        this.classList.remove('drag-over');
        var fromIdx = parseInt(ev.dataTransfer.getData('text/plain'), 10);
        var toIdx = parseInt(this.dataset.index, 10);
        if (isNaN(fromIdx) || isNaN(toIdx)) return;
        var grid = getGrid();
        if (!grid[fromIdx]) return;
        if (!grid[toIdx]) {
          grid[toIdx] = grid[fromIdx];
          grid[fromIdx] = null;
          renderMergeGrid();
          if (typeof renderTownMap === 'function') renderTownMap();
        } else {
          tryMerge(fromIdx, toIdx);
        }
      });
      container.appendChild(cell);
    }
  }

  function renderGenerators() {
    var wrap = document.getElementById('merge-generators');
    if (!wrap) return;
    wrap.innerHTML = '';
    (CHAIN_KEYS || ['wheat', 'milk', 'veggie']).forEach(function(key) {
      var chain = CHAINS[key];
      if (!chain || !chain[0]) return;
      var first = chain[0];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'merge-generator-btn';
      if (first.img) {
        var ico = document.createElement('img');
        ico.className = 'merge-generator-icon';
        ico.src = first.img;
        ico.alt = first.name;
        ico.onerror = function() { this.style.display = 'none'; };
        btn.appendChild(ico);
      }
      btn.appendChild(document.createTextNode(first.name + ' (' + COST + ' E)'));
      btn.onclick = function() { spawnFromGenerator(key); };
      wrap.appendChild(btn);
    });
  }

  function updateEnergyUI() {
    var el = document.getElementById('energy-num');
    if (el) el.textContent = state.energy || 0;
  }

  global.renderMergeGrid = renderMergeGrid;
  global.renderGenerators = renderGenerators;
  global.updateEnergyUI = updateEnergyUI;
  global.spawnFromGenerator = spawnFromGenerator;
})(typeof window !== 'undefined' ? window : this);
