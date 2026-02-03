/**
 * Board & Cooking - 棋盘与掷骰子逻辑（依赖 config.js, state.js, items.js）
 */
(function(global) {
  var _moveStepTids = [];
  var _diceResultHideTid = null;
  var _gainHideTid = null;
  var DICE_RESULT_STAY_MS = 2500;

  function pathIndexAt(r, c) {
    var i = PATH_GRID.findIndex(function(p) { return p[0] === r && p[1] === c; });
    return i >= 0 ? i : null;
  }

  function initBoard() {
    state.boardTiles = [];
    for (var i = 0; i < BOARD_CELLS; i++) {
      state.boardTiles.push(TILE_TYPES[i % TILE_TYPES.length]);
    }
    var board = document.getElementById('board');
    board.innerHTML = '';
    var n = HOLLOW_GRID_SIZE;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var cell = document.createElement('div');
        var pathIdx = pathIndexAt(r, c);
        if (pathIdx === null) {
          cell.className = 'tile tile-empty';
          cell.setAttribute('aria-hidden', 'true');
        } else {
          var type = state.boardTiles[pathIdx];
          var isCurrent = state.position === pathIdx;
          cell.className = 'tile ' + type + (isCurrent ? ' current' : '');
          cell.dataset.pathIndex = pathIdx;
          if (TILE_IMAGE && TILE_IMAGE[type]) {
            var img = document.createElement('img');
            img.className = 'tile-img';
            img.src = TILE_IMAGE[type];
            img.alt = '';
            img.onerror = function() { this.classList.add('tile-img-fail'); };
            cell.appendChild(img);
          }
          var fallback = document.createElement('span');
          fallback.className = 'tile-fallback';
          fallback.textContent = TILE_EMOJI[type];
          cell.appendChild(fallback);
        }
        board.appendChild(cell);
      }
    }
    updatePlayerToken();
  }

  function updatePlayerToken() {
    var token = document.getElementById('player-token');
    var wrap = document.querySelector('.board-wrap');
    if (!wrap) return;
    var row = PATH_GRID[state.position][0], col = PATH_GRID[state.position][1];
    var cellW = wrap.offsetWidth / HOLLOW_GRID_SIZE;
    var cellH = wrap.offsetHeight / HOLLOW_GRID_SIZE;
    token.style.left = (col * cellW + cellW / 2 - 20) + 'px';
    token.style.top = (row * cellH + cellH / 2 - 20) + 'px';
  }

  function updateCurrentTileHighlight() {
    var pathIdx = state.position;
    document.querySelectorAll('#board .tile[data-path-index]').forEach(function(el) {
      el.classList.toggle('current', parseInt(el.dataset.pathIndex, 10) === pathIdx);
    });
  }

  function rollDice() {
    var need = state.bet;
    if (state.dice < need || state.moving) {
      if (!state.moving) showToast('骰子不足，去订单完成奖励获取吧~');
      return;
    }
    state.dice -= need;
    if (_gainHideTid) { clearTimeout(_gainHideTid); _gainHideTid = null; }
    if (_diceResultHideTid) { clearTimeout(_diceResultHideTid); _diceResultHideTid = null; }
    var steps = 1 + Math.floor(Math.random() * 6);
    state.lastRollSteps = steps;
    state.moving = true;
    updateBoardGainUI();
    updateDiceResultUI();
    updateRollButton();

    var startPos = state.position;
    var total = BOARD_CELLS;
    var stepDelayMs = 150;

    _moveStepTids.forEach(function(tid) { clearTimeout(tid); });
    _moveStepTids = [];

    for (var step = 1; step <= steps; step++) {
      (function(s) {
        var tid = setTimeout(function() {
          state.position = (startPos + s) % total;
          updatePlayerToken();
          updateCurrentTileHighlight();
          if (s === steps) {
            state.moving = false;
            if (_diceResultHideTid) clearTimeout(_diceResultHideTid);
            _diceResultHideTid = setTimeout(function() {
              updateDiceResultUI();
              _diceResultHideTid = null;
            }, DICE_RESULT_STAY_MS);
            var tileType = state.boardTiles[state.position];
            var dropTable = TILE_DROP_TABLES[tileType] || [{ id: TILE_GAIN[tileType], weight: 100 }];
            var gainId = pickFromDropTable(dropTable);
            var qty = state.bet;
            addInv(gainId, qty);
            showGainFeedback(gainId, qty);
            updateDiceUI();
            updateBetUI();
            updateRollButton();
            playTokenLanding();
          }
        }, (s - 1) * stepDelayMs);
        _moveStepTids.push(tid);
      })(step);
    }
  }

  function playTokenLanding() {
    var token = document.getElementById('player-token');
    if (!token) return;
    token.classList.remove('player-token-land');
    token.offsetHeight;
    token.classList.add('player-token-land');
    setTimeout(function() { token.classList.remove('player-token-land'); }, 320);
  }

  function updateRollButton() {
    var btn = document.getElementById('btn-roll');
    if (btn) btn.disabled = state.dice < state.bet || state.moving;
  }

  function pickFromDropTable(dropTable) {
    var total = dropTable.reduce(function(s, e) { return s + e.weight; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < dropTable.length; i++) {
      r -= dropTable[i].weight;
      if (r <= 0) return dropTable[i].id;
    }
    return dropTable[dropTable.length - 1].id;
  }

  function showGainFeedback(itemId, qty) {
    var info = getItemInfo(itemId);
    var level = getItemLevel(itemId);
    state.lastGain = { itemId: itemId, qty: qty, level: level };
    updateBoardGainUI();
    if (_gainHideTid) clearTimeout(_gainHideTid);
    _gainHideTid = setTimeout(function() {
      state.lastGain = null;
      updateBoardGainUI();
      _gainHideTid = null;
    }, 2500);
  }

  function updateBoardGainUI() {
    var wrap = document.getElementById('board-gain');
    if (!wrap) return;
    var lastGain = state.lastGain;
    wrap.classList.remove('gain-lucky', 'gain-rare');
    if (lastGain) {
      var info = getItemInfo(lastGain.itemId);
      var level = lastGain.level || 0;
      if (level >= 3) wrap.classList.add('gain-rare');
      else if (level >= 2) wrap.classList.add('gain-lucky');
      var label = '';
      if (level >= 3) label = '<span class="board-gain-tag gain-tag-rare">稀有！</span>';
      else if (level >= 2) label = '<span class="board-gain-tag gain-tag-lucky">幸运！</span>';
      wrap.innerHTML = label + '<span class="board-gain-content">' + info.emoji + ' ' + info.name + ' ×' + lastGain.qty + '</span>';
      wrap.setAttribute('aria-label', '本次获得 ' + info.name + ' ×' + lastGain.qty);
      return;
    }
    wrap.innerHTML = '<span class="board-gain-placeholder">—</span>';
    wrap.setAttribute('aria-label', '本次获得');
  }

  function updateDiceResultUI() {
    var el = document.getElementById('board-dice-result');
    var valueEl = document.getElementById('board-dice-value');
    if (!el || !valueEl) return;
    if (state.moving && state.lastRollSteps) {
      valueEl.textContent = state.lastRollSteps;
      el.setAttribute('aria-label', '骰子点数 ' + state.lastRollSteps);
      el.classList.remove('hidden');
      el.classList.add('visible');
    } else {
      el.classList.add('hidden');
      el.classList.remove('visible');
    }
  }

  function setBet(value) {
    if (BET_OPTIONS.indexOf(value) === -1) return;
    state.bet = value;
    updateBetUI();
    updateRollButton();
  }

  function cycleBet() {
    var idx = BET_OPTIONS.indexOf(state.bet);
    var next = BET_OPTIONS[(idx + 1) % BET_OPTIONS.length];
    state.bet = next;
    updateBetUI();
    updateRollButton();
  }

  function updateBetUI() {
    var hint = document.getElementById('roll-hint');
    if (hint) hint.textContent = '消耗 ' + state.bet + ' 个骰子，获得 ' + state.bet + ' 倍材料';
    var btn = document.getElementById('bet-cycle-btn');
    if (btn) {
      btn.textContent = '×' + state.bet;
      btn.disabled = state.dice < state.bet;
    }
  }

  function gmAddDice(ev) {
    if (ev && ev.target) ev.target.blur();
    state.dice += 20;
    updateDiceUI();
    updateBetUI();
    updateRollButton();
  }

  function updateDiceUI() {
    var el = document.getElementById('dice-num');
    if (el) el.textContent = state.dice;
    if (state.bet > state.dice) {
      var allowed = BET_OPTIONS.filter(function(x) { return x <= state.dice; });
      state.bet = allowed.length ? Math.max.apply(null, allowed) : BET_OPTIONS[0];
    }
    updateBetUI();
    updateRollButton();
  }

  function showToast(msg, duration) {
    if (duration === undefined) duration = 1200;
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._tid);
    toast._tid = setTimeout(function() { toast.classList.add('hidden'); }, duration);
  }

  global.pathIndexAt = pathIndexAt;
  global.initBoard = initBoard;
  global.updatePlayerToken = updatePlayerToken;
  global.updateCurrentTileHighlight = updateCurrentTileHighlight;
  global.rollDice = rollDice;
  global.playTokenLanding = playTokenLanding;
  global.updateRollButton = updateRollButton;
  global.pickFromDropTable = pickFromDropTable;
  global.showGainFeedback = showGainFeedback;
  global.updateBoardGainUI = updateBoardGainUI;
  global.updateDiceResultUI = updateDiceResultUI;
  global.setBet = setBet;
  global.cycleBet = cycleBet;
  global.updateBetUI = updateBetUI;
  global.gmAddDice = gmAddDice;
  global.updateDiceUI = updateDiceUI;
  global.showToast = showToast;
})(typeof window !== 'undefined' ? window : this);
