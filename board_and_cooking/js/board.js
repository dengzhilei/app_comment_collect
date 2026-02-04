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

  /** doc_3 v2：获取路径格的特殊类型 */
  function getSpecialTileKind(pathIndex) {
    var airports = (typeof BOARD_AIRPORT_PATH_INDICES !== 'undefined' && Array.isArray(BOARD_AIRPORT_PATH_INDICES)) ? BOARD_AIRPORT_PATH_INDICES : [];
    var corners = (typeof BOARD_CORNER_PATH_INDICES !== 'undefined' && Array.isArray(BOARD_CORNER_PATH_INDICES)) ? BOARD_CORNER_PATH_INDICES : [];
    var goIdx = (typeof BOARD_GO_PATH_INDEX !== 'undefined' && BOARD_GO_PATH_INDEX != null) ? BOARD_GO_PATH_INDEX : 30;
    if (airports.indexOf(pathIndex) !== -1) return 'airport';
    if (corners.indexOf(pathIndex) !== -1) return pathIndex === goIdx ? 'corner_go' : 'corner';
    if (state.boardQuestionIndices && state.boardQuestionIndices.indexOf(pathIndex) !== -1) return 'question';
    return null;
  }

  /** 均匀分配：按数量从多到少，每种类型在剩余空位中均匀放置，保证沿路径错开、不相邻聚集。 */
  function assignTilesStaggered(normalIndices, specialSet, tileCounts) {
    if (!tileCounts || normalIndices.length === 0) return null;
    var n = BOARD_CELLS;
    var typeList = [];
    var total = 0;
    for (var ti = 0; ti < TILE_TYPES.length; ti++) {
      var t = TILE_TYPES[ti];
      var c = Math.max(0, parseInt(tileCounts[t], 10) || 0);
      if (c > 0) {
        typeList.push({ type: t, count: c });
        total += c;
      }
    }
    if (total !== normalIndices.length) return null;
    typeList.sort(function(a, b) { return b.count - a.count; });
    var result = new Array(n);
    var available = normalIndices.slice();
    for (var ti = 0; ti < typeList.length; ti++) {
      var t = typeList[ti].type;
      var count = typeList[ti].count;
      var len = available.length;
      if (count === 0 || len === 0) continue;
      var step = len / count;
      var chosen = [];
      for (var k = 0; k < count; k++) {
        var idx = Math.min(Math.floor((k + 0.5) * step), len - 1);
        chosen.push(available[idx]);
      }
      for (var ci = 0; ci < chosen.length; ci++) result[chosen[ci]] = t;
      available = available.filter(function(pi) { return chosen.indexOf(pi) === -1; });
    }
    return result;
  }

  function initBoard() {
    state.boardTiles = [];
    var airports = (typeof BOARD_AIRPORT_PATH_INDICES !== 'undefined' && Array.isArray(BOARD_AIRPORT_PATH_INDICES)) ? BOARD_AIRPORT_PATH_INDICES : [];
    var corners = (typeof BOARD_CORNER_PATH_INDICES !== 'undefined' && Array.isArray(BOARD_CORNER_PATH_INDICES)) ? BOARD_CORNER_PATH_INDICES : [];
    var qIndices = (typeof BOARD_QUESTION_PATH_INDICES !== 'undefined' && Array.isArray(BOARD_QUESTION_PATH_INDICES)) ? BOARD_QUESTION_PATH_INDICES : null;
    if (qIndices && qIndices.length > 0) {
      state.boardQuestionIndices = qIndices.filter(function(i) { return i >= 0 && i < BOARD_CELLS; });
    } else {
      var exclude = {};
      airports.forEach(function(i) { exclude[i] = true; });
      corners.forEach(function(i) { exclude[i] = true; });
      var pool = [];
      for (var i = 0; i < BOARD_CELLS; i++) if (!exclude[i]) pool.push(i);
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      var qCount = (typeof BOARD_QUESTION_MARK_COUNT !== 'undefined' && BOARD_QUESTION_MARK_COUNT > 0) ? BOARD_QUESTION_MARK_COUNT : 3;
      state.boardQuestionIndices = pool.slice(0, qCount);
    }
    var specialSet = {};
    airports.forEach(function(i) { specialSet[i] = true; });
    corners.forEach(function(i) { specialSet[i] = true; });
    state.boardQuestionIndices.forEach(function(i) { specialSet[i] = true; });
    var normalIndices = [];
    for (var i = 0; i < BOARD_CELLS; i++) if (!specialSet[i]) normalIndices.push(i);
    var tileCounts = (typeof TILE_COUNTS !== 'undefined' && TILE_COUNTS && typeof TILE_COUNTS === 'object') ? TILE_COUNTS : null;
    var assignedByPath = assignTilesStaggered(normalIndices, specialSet, tileCounts);
    for (var i = 0; i < BOARD_CELLS; i++) {
      if (assignedByPath && assignedByPath[i]) {
        state.boardTiles.push(assignedByPath[i]);
      } else {
        state.boardTiles.push(TILE_TYPES[i % TILE_TYPES.length]);
      }
    }
    state.position = (typeof BOARD_GO_PATH_INDEX !== 'undefined' && BOARD_GO_PATH_INDEX != null) ? BOARD_GO_PATH_INDEX : 0;

    var board = document.getElementById('board');
    var inner = document.getElementById('board-inner');
    var wrap = document.querySelector('.board-wrap');
    if (!board) return;
    board.innerHTML = '';
    var n = HOLLOW_GRID_SIZE;
    board.style.gridTemplateColumns = 'repeat(' + n + ', 1fr)';
    board.style.gridTemplateRows = 'repeat(' + n + ', 1fr)';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var cell = document.createElement('div');
        var pathIdx = pathIndexAt(r, c);
        if (pathIdx === null) {
          cell.className = 'tile tile-empty';
          cell.setAttribute('aria-hidden', 'true');
        } else {
          var special = getSpecialTileKind(pathIdx);
          var isCurrent = state.position === pathIdx;
          var type = state.boardTiles[pathIdx];
          if (special === 'airport') {
            cell.className = 'tile tile-airport' + (isCurrent ? ' current' : '');
            cell.dataset.pathIndex = pathIdx;
            var fb = document.createElement('span');
            fb.className = 'tile-fallback';
            fb.textContent = '✈️';
            cell.appendChild(fb);
          } else if (special === 'corner' || special === 'corner_go') {
            cell.className = 'tile tile-corner' + (isCurrent ? ' current' : '');
            cell.dataset.pathIndex = pathIdx;
            var fb2 = document.createElement('span');
            fb2.className = 'tile-fallback';
            fb2.textContent = special === 'corner_go' ? 'GO' : '';
            cell.appendChild(fb2);
          } else if (special === 'question') {
            cell.className = 'tile tile-question' + (isCurrent ? ' current' : '');
            cell.dataset.pathIndex = pathIdx;
            var fb3 = document.createElement('span');
            fb3.className = 'tile-fallback';
            fb3.textContent = '?';
            cell.appendChild(fb3);
          } else {
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
        }
        board.appendChild(cell);
      }
    }
    if (wrap && inner) {
      var vc = (typeof BOARD_VIEWPORT_CELLS !== 'undefined' && BOARD_VIEWPORT_CELLS > 0) ? BOARD_VIEWPORT_CELLS : 5;
      var cw = wrap.offsetWidth || 300;
      var cellPx = cw / vc;
      var boardPx = cellPx * n;
      inner.style.width = boardPx + 'px';
      inner.style.height = boardPx + 'px';
      board.style.width = boardPx + 'px';
      board.style.height = boardPx + 'px';
    }
    updatePlayerToken();
    updateBoardCamera();
  }

  function updatePlayerToken() {
    var token = document.getElementById('player-token');
    var wrap = document.querySelector('.board-wrap');
    if (!token || !wrap) return;
    var vc = (typeof BOARD_VIEWPORT_CELLS !== 'undefined' && BOARD_VIEWPORT_CELLS > 0) ? BOARD_VIEWPORT_CELLS : 5;
    var cellPx = (wrap.offsetWidth || 300) / vc;
    var row = PATH_GRID[state.position][0], col = PATH_GRID[state.position][1];
    token.style.left = (col * cellPx + cellPx / 2) + 'px';
    token.style.top = (row * cellPx + cellPx / 2) + 'px';
  }

  /** doc_3 v1：镜头跟随棋子，只显示视口内部分；顺带根据视口尺寸更新棋盘内层大小 */
  function updateBoardCamera() {
    var inner = document.getElementById('board-inner');
    var board = document.getElementById('board');
    var wrap = document.querySelector('.board-wrap');
    if (!inner || !wrap) return;
    var vc = (typeof BOARD_VIEWPORT_CELLS !== 'undefined' && BOARD_VIEWPORT_CELLS > 0) ? BOARD_VIEWPORT_CELLS : 5;
    var vw = wrap.offsetWidth || 300;
    var vh = wrap.offsetHeight || 300;
    var cellPx = vw / vc;
    var boardPx = cellPx * HOLLOW_GRID_SIZE;
    if (inner.style.width !== boardPx + 'px') {
      inner.style.width = boardPx + 'px';
      inner.style.height = boardPx + 'px';
      if (board) {
        board.style.width = boardPx + 'px';
        board.style.height = boardPx + 'px';
      }
    }
    var row = PATH_GRID[state.position][0], col = PATH_GRID[state.position][1];
    var tx = vw / 2 - (col + 0.5) * cellPx;
    var ty = vh / 2 - (row + 0.5) * cellPx;
    tx = Math.max(vw - boardPx, Math.min(0, tx));
    ty = Math.max(vh - boardPx, Math.min(0, ty));
    inner.style.transform = 'translate(' + tx + 'px, ' + ty + 'px)';
  }

  function updateCurrentTileHighlight() {
    var pathIdx = state.position;
    document.querySelectorAll('#board .tile[data-path-index]').forEach(function(el) {
      el.classList.toggle('current', parseInt(el.dataset.pathIndex, 10) === pathIdx);
    });
  }

  function rollDice() {
    var need = (typeof DICE_PER_ROLL !== 'undefined' && DICE_PER_ROLL > 0) ? DICE_PER_ROLL : 2;
    if (state.dice < need || state.moving) {
      if (!state.moving) showToast('骰子不足，去订单完成奖励获取吧~');
      return;
    }
    state.dice -= need;
    if (_gainHideTid) { clearTimeout(_gainHideTid); _gainHideTid = null; }
    if (_diceResultHideTid) { clearTimeout(_diceResultHideTid); _diceResultHideTid = null; }
    var d1, d2, steps;
    if (state.gmNextRollSteps != null && state.gmNextRollSteps >= 2 && state.gmNextRollSteps <= 12) {
      steps = state.gmNextRollSteps;
      d1 = Math.floor(steps / 2);
      d2 = steps - d1;
      state.gmNextRollSteps = null;
    } else {
      d1 = 1 + Math.floor(Math.random() * 6);
      d2 = 1 + Math.floor(Math.random() * 6);
      steps = d1 + d2;
    }
    state.lastRollSteps = steps;
    state.lastRollDice = [d1, d2];
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
          updateBoardCamera();
          updateCurrentTileHighlight();
          if (s === steps) {
            state.moving = false;
            if (_diceResultHideTid) clearTimeout(_diceResultHideTid);
            _diceResultHideTid = setTimeout(function() {
              updateDiceResultUI();
              _diceResultHideTid = null;
            }, DICE_RESULT_STAY_MS);
            var special = getSpecialTileKind(state.position);
            var bet = state.bet || 1;
            if (special === 'airport') {
              var r = Math.random();
              var mult = r < 0.33 ? 1 : (r < 0.66 ? 2 : 3);
              var diceGain = bet * mult;
              state.dice += diceGain;
              state.lastGain = { type: 'dice', qty: diceGain };
              updateBoardGainUI();
              if (_gainHideTid) clearTimeout(_gainHideTid);
              _gainHideTid = setTimeout(function() { state.lastGain = null; updateBoardGainUI(); _gainHideTid = null; }, 2500);
              var msg = (mult === 1 ? '攻击失败' : (mult === 2 ? '攻击成功' : '偷窃成功')) + '，获得骰子 ×' + diceGain;
              showToast(msg);
              updateDiceUI();
              updateBetUI();
              updateRollButton();
              playTokenLanding();
            } else if (special === 'corner' || special === 'corner_go') {
              state.lastGain = null;
              updateBoardGainUI();
              updateRollButton();
              playTokenLanding();
            } else if (special === 'question') {
              var qty = state.bet || 1;
              var qr = Math.random();
              if (qr < 0.34) {
                var baseIdsHarvest = BASE_ITEM_IDS || [];
                baseIdsHarvest.forEach(function(id) { addInv(id, qty); });
                state.lastGain = { type: 'harvest', items: baseIdsHarvest.map(function(id) { return { itemId: id, qty: qty }; }) };
                updateBoardGainUI();
                showToast('大丰收！');
              } else if (qr < 0.67) {
                var baseIds = BASE_ITEM_IDS || [];
                var bid = baseIds[Math.floor(Math.random() * baseIds.length)] || baseIds[0];
                if (bid) { addInv(bid, qty); state.lastGain = { itemId: bid, qty: qty, level: 1 }; showGainFeedback(bid, qty); }
                else { state.lastGain = null; updateBoardGainUI(); }
              } else {
                var advanced = [];
                for (var key in CHAINS) {
                  var chain = CHAINS[key];
                  for (var i = 1; i < chain.length; i++) {
                    if (typeof isChainItemUnlocked === 'function' && isChainItemUnlocked(chain[i].id)) advanced.push(chain[i].id);
                  }
                }
                (CROSS_RECIPES || []).forEach(function(rec) {
                  if (typeof isCrossRecipeUnlocked === 'function' && isCrossRecipeUnlocked(rec)) advanced.push(rec.id);
                });
                if (advanced.length > 0) {
                  var aid = advanced[Math.floor(Math.random() * advanced.length)];
                  addInv(aid, qty);
                  var lv = typeof getItemLevel === 'function' ? getItemLevel(aid) : 0;
                  showGainFeedback(aid, qty);
                  state.lastGain = { itemId: aid, qty: qty, level: lv, fromQuestionLucky: true };
                  showToast('太幸运了！问号格开出高级/合成材料~');
                } else {
                  var bid2 = (BASE_ITEM_IDS || [])[0];
                  if (bid2) { addInv(bid2, qty); showGainFeedback(bid2, qty); }
                  else { state.lastGain = null; updateBoardGainUI(); }
                }
              }
              if (state.lastGain && state.lastGain.type !== 'harvest' && !state.lastGain.itemId) state.lastGain = null;
              if (_gainHideTid) clearTimeout(_gainHideTid);
              _gainHideTid = setTimeout(function() { state.lastGain = null; updateBoardGainUI(); _gainHideTid = null; }, 2500);
              updateDiceUI();
              updateBetUI();
              updateRollButton();
              playTokenLanding();
            } else {
              var tileType = state.boardTiles[state.position];
              var rawTable = TILE_DROP_TABLES[tileType] || [{ id: TILE_GAIN[tileType], weight: 100 }];
              var dropTable = rawTable.filter(function(e) { return isChainItemUnlocked(e.id); });
              if (dropTable.length === 0) dropTable = [{ id: TILE_GAIN[tileType], weight: 100 }];
              var gainId = pickFromDropTable(dropTable);
              var qty = state.bet;
              addInv(gainId, qty);
              showGainFeedback(gainId, qty);
              updateDiceUI();
              updateBetUI();
              updateRollButton();
              playTokenLanding();
            }
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
    var need = (typeof DICE_PER_ROLL !== 'undefined' && DICE_PER_ROLL > 0) ? DICE_PER_ROLL : 2;
    if (btn) btn.disabled = state.dice < need || state.moving;
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
      if (lastGain.type === 'dice') {
        wrap.innerHTML = '<span class="board-gain-content">🎲 骰子 ×' + (lastGain.qty || 0) + '</span>';
        wrap.setAttribute('aria-label', '本次获得 骰子 ×' + lastGain.qty);
        return;
      }
      if (lastGain.type === 'harvest') {
        if (lastGain.items && lastGain.items.length > 0) {
          var parts = lastGain.items.map(function(it) {
            var info = getItemInfo(it.itemId);
            return info.emoji + ' ' + info.name + ' ×' + (it.qty != null ? it.qty : 1);
          });
          wrap.innerHTML = '<span class="board-gain-tag gain-tag-harvest">大丰收！</span><span class="board-gain-content board-gain-harvest-list">' + parts.join('　') + '</span>';
          wrap.setAttribute('aria-label', '本次获得 大丰收 ' + parts.join('，'));
        } else {
          var hq = lastGain.qty != null ? lastGain.qty : 1;
          wrap.innerHTML = '<span class="board-gain-content">大丰收！每种材料各 ×' + hq + '</span>';
          wrap.setAttribute('aria-label', '本次获得 大丰收 ×' + hq);
        }
        return;
      }
      var info = getItemInfo(lastGain.itemId);
      var level = lastGain.level || 0;
      var questionLucky = lastGain.fromQuestionLucky;
      if (level >= 3) wrap.classList.add('gain-rare');
      else if (level >= 2 || questionLucky) wrap.classList.add('gain-lucky');
      var label = '';
      if (level >= 3) label = '<span class="board-gain-tag gain-tag-rare">稀有！</span>';
      else if (questionLucky) label = '<span class="board-gain-tag gain-tag-lucky">太幸运了！</span>';
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
    if (state.moving && state.lastRollSteps != null) {
      if (state.lastRollDice && state.lastRollDice.length >= 2) {
        valueEl.textContent = state.lastRollDice[0] + ' + ' + state.lastRollDice[1] + ' = ' + state.lastRollSteps;
        el.setAttribute('aria-label', '骰子 ' + state.lastRollDice[0] + ' + ' + state.lastRollDice[1] + '，共 ' + state.lastRollSteps + ' 步');
      } else {
        valueEl.textContent = state.lastRollSteps;
        el.setAttribute('aria-label', '骰子点数 ' + state.lastRollSteps);
      }
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
    var need = (typeof DICE_PER_ROLL !== 'undefined' && DICE_PER_ROLL > 0) ? DICE_PER_ROLL : 2;
    if (hint) hint.textContent = '每次消耗 ' + need + ' 个骰子掷一次，获得 ×' + state.bet + ' 倍材料';
    var btn = document.getElementById('bet-cycle-btn');
    if (btn) {
      btn.textContent = '×' + state.bet;
      btn.disabled = state.dice < need;
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

  function updateChefUI() {
    var el = document.getElementById('chef-level-num');
    var wrap = document.getElementById('chef-level-wrap');
    var fill = document.getElementById('chef-exp-fill');
    if (!el) return;
    var level = state.chefLevel || 1;
    var exp = state.chefExp || 0;
    el.textContent = 'Lv.' + level;
    var next = CHEF_EXP_THRESHOLDS && CHEF_EXP_THRESHOLDS[level - 1];
    if (wrap) {
      wrap.title = level >= 4 ? '厨师经验：已满级' : ('经验 ' + exp + (next != null ? ' / 升Lv.' + (level + 1) + ' 需 ' + next : ''));
      wrap.classList.toggle('chef-max', level >= 4);
    }
    if (fill) {
      if (level >= 4) {
        fill.style.width = '100%';
      } else if (next != null && next > 0) {
        var pct = Math.min(100, Math.floor((exp / next) * 100));
        fill.style.width = pct + '%';
      } else {
        fill.style.width = '0%';
      }
    }
  }

  /** v3：计算指定厨师等级本次解锁的链内物品与交叉配方 */
  function getUnlocksAtLevel(level) {
    var chainList = [];
    var prevMaxByLevel = level === 1 ? null : (CHEF_LEVEL_CHAIN_MAX && CHEF_LEVEL_CHAIN_MAX[level - 1]);
    var currMaxByLevel = (CHEF_LEVEL_CHAIN_MAX && CHEF_LEVEL_CHAIN_MAX[level]) || {};
    for (var chainKey in CHAINS) {
      if (!CHAINS[chainKey]) continue;
      var prevMax = (prevMaxByLevel && prevMaxByLevel[chainKey]) || 0;
      var currMax = currMaxByLevel[chainKey] || 0;
      for (var i = prevMax; i < currMax; i++) {
        chainList.push(CHAINS[chainKey][i]);
      }
    }
    var crossList = (CROSS_RECIPES || []).filter(function(r) {
      return (r.unlockChefLevel != null ? r.unlockChefLevel : 1) === level;
    });
    return { chain: chainList, cross: crossList };
  }

  var _levelUpModalBound = false;
  /** v3：显示厨师升级弹窗（本次解锁的基础/合成菜品 + 仪式感） */
  function showLevelUpModal(newLevel) {
    var modal = document.getElementById('modal-level-up');
    var promotionEl = document.getElementById('level-up-promotion');
    var lvEl = document.getElementById('level-up-lv');
    var chainListEl = document.getElementById('level-up-chain-list');
    var crossListEl = document.getElementById('level-up-cross-list');
    if (!modal || !chainListEl || !crossListEl) return;
    if (!_levelUpModalBound) {
      _levelUpModalBound = true;
      var btn = document.getElementById('btn-close-level-up');
      if (btn) btn.addEventListener('click', function() {
        modal.classList.add('hidden');
        if (typeof updateChefUI === 'function') updateChefUI();
      });
    }
    var unlocks = getUnlocksAtLevel(newLevel);
    var title = (typeof CHEF_LEVEL_TITLES !== 'undefined' && CHEF_LEVEL_TITLES[newLevel]) ? CHEF_LEVEL_TITLES[newLevel] : 'Lv.' + newLevel;
    if (promotionEl) promotionEl.textContent = '晋升成为 ' + title + '！';
    if (lvEl) lvEl.textContent = 'Lv.' + newLevel;
    chainListEl.innerHTML = '';
    unlocks.chain.forEach(function(item) {
      var li = document.createElement('li');
      li.className = 'level-up-new-item';
      li.innerHTML = '<span class="level-up-new-tag">新</span>' + item.emoji + ' ' + item.name;
      chainListEl.appendChild(li);
    });
    crossListEl.innerHTML = '';
    unlocks.cross.forEach(function(rec) {
      var li = document.createElement('li');
      li.className = 'level-up-new-item';
      li.innerHTML = '<span class="level-up-new-tag">新</span>' + (rec.emoji || '') + ' ' + (rec.name || rec.id);
      crossListEl.appendChild(li);
    });
    modal.classList.remove('hidden');
  }

  global.pathIndexAt = pathIndexAt;
  global.initBoard = initBoard;
  global.updatePlayerToken = updatePlayerToken;
  global.updateBoardCamera = updateBoardCamera;
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
  global.updateChefUI = updateChefUI;
  global.getUnlocksAtLevel = getUnlocksAtLevel;
  global.showLevelUpModal = showLevelUpModal;
})(typeof window !== 'undefined' ? window : this);
