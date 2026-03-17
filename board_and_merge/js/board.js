/**
 * Board & Merge - board and dice (tiles: money = no effect, energy = add energy)
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

  function getSpecialTileKind(pathIndex) {
    var airports = (typeof BOARD_AIRPORT_PATH_INDICES !== 'undefined' && Array.isArray(BOARD_AIRPORT_PATH_INDICES)) ? BOARD_AIRPORT_PATH_INDICES : [];
    var corners = (typeof BOARD_CORNER_PATH_INDICES !== 'undefined' && Array.isArray(BOARD_CORNER_PATH_INDICES)) ? BOARD_CORNER_PATH_INDICES : [];
    var goIdx = (typeof BOARD_GO_PATH_INDEX !== 'undefined' && BOARD_GO_PATH_INDEX != null) ? BOARD_GO_PATH_INDEX : 30;
    if (airports.indexOf(pathIndex) !== -1) return 'airport';
    if (corners.indexOf(pathIndex) !== -1) return pathIndex === goIdx ? 'corner_go' : 'corner';
    if (state.boardQuestionIndices && state.boardQuestionIndices.indexOf(pathIndex) !== -1) return 'question';
    return null;
  }

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
      state.boardQuestionIndices = pool.slice(0, 3);
    }
    var specialSet = {};
    airports.forEach(function(i) { specialSet[i] = true; });
    corners.forEach(function(i) { specialSet[i] = true; });
    state.boardQuestionIndices.forEach(function(i) { specialSet[i] = true; });
    var normalIndices = [];
    for (var i = 0; i < BOARD_CELLS; i++) if (!specialSet[i]) normalIndices.push(i);
    var tileCounts = (typeof TILE_COUNTS !== 'undefined' && TILE_COUNTS) ? TILE_COUNTS : null;
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
            cell.appendChild(document.createElement('span')).className = 'tile-fallback';
            cell.lastChild.textContent = '\u2708\uFE0F';
          } else if (special === 'corner' || special === 'corner_go') {
            cell.className = 'tile tile-corner' + (isCurrent ? ' current' : '');
            cell.dataset.pathIndex = pathIdx;
            cell.appendChild(document.createElement('span')).className = 'tile-fallback';
            cell.lastChild.textContent = special === 'corner_go' ? 'GO' : '';
          } else if (special === 'question') {
            cell.className = 'tile tile-question' + (isCurrent ? ' current' : '');
            cell.dataset.pathIndex = pathIdx;
            cell.appendChild(document.createElement('span')).className = 'tile-fallback';
            cell.lastChild.textContent = '?';
          } else {
            cell.className = 'tile tile-' + type + (isCurrent ? ' current' : '');
            cell.dataset.pathIndex = pathIdx;
            var fallback = document.createElement('span');
            fallback.className = 'tile-fallback';
            fallback.textContent = TILE_EMOJI[type] || type;
            cell.appendChild(fallback);
          }
        }
        board.appendChild(cell);
      }
    }
    if (wrap && inner) {
      var vc = BOARD_VIEWPORT_CELLS || 5;
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
    var vc = BOARD_VIEWPORT_CELLS || 5;
    var cellPx = (wrap.offsetWidth || 300) / vc;
    var row = PATH_GRID[state.position][0], col = PATH_GRID[state.position][1];
    token.style.left = (col * cellPx + cellPx / 2) + 'px';
    token.style.top = (row * cellPx + cellPx / 2) + 'px';
  }

  function updateBoardCamera() {
    var inner = document.getElementById('board-inner');
    var wrap = document.querySelector('.board-wrap');
    if (!inner || !wrap) return;
    var vc = BOARD_VIEWPORT_CELLS || 5;
    var vw = wrap.offsetWidth || 300;
    var vh = wrap.offsetHeight || 300;
    var cellPx = vw / vc;
    var boardPx = cellPx * HOLLOW_GRID_SIZE;
    if (inner.style.width !== boardPx + 'px') {
      inner.style.width = boardPx + 'px';
      inner.style.height = boardPx + 'px';
      var board = document.getElementById('board');
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
      if (!state.moving) showToast('Not enough dice');
      return;
    }
    state.dice -= need;
    updateDiceUI();
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
            try {
              if (_diceResultHideTid) clearTimeout(_diceResultHideTid);
              _diceResultHideTid = setTimeout(function() {
                updateDiceResultUI();
                _diceResultHideTid = null;
              }, DICE_RESULT_STAY_MS);
              var special = getSpecialTileKind(state.position);
              var bet = state.bet || 1;
              var energyPerBet = (typeof ENERGY_PER_BET !== 'undefined' && ENERGY_PER_BET > 0) ? ENERGY_PER_BET : 2;

              if (special === 'airport') {
                var r = Math.random();
                var mult = r < 0.33 ? 1 : (r < 0.66 ? 2 : 3);
                var diceGain = bet * mult;
                state.dice += diceGain;
                state.lastGain = { type: 'dice', qty: diceGain };
                updateBoardGainUI();
                if (_gainHideTid) clearTimeout(_gainHideTid);
                _gainHideTid = setTimeout(function() { state.lastGain = null; updateBoardGainUI(); _gainHideTid = null; }, 2500);
                showToast('Dice +' + diceGain);
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
                var qty = bet * energyPerBet;
                state.energy = (state.energy || 0) + qty;
                state.lastGain = { type: 'energy', qty: qty };
                updateBoardGainUI();
                if (_gainHideTid) clearTimeout(_gainHideTid);
                _gainHideTid = setTimeout(function() { state.lastGain = null; updateBoardGainUI(); _gainHideTid = null; }, 2500);
                if (typeof updateEnergyUI === 'function') updateEnergyUI();
                updateRollButton();
                playTokenLanding();
              } else {
                var tileType = state.boardTiles[state.position];
                if (tileType === 'money') {
                  state.lastGain = null;
                  updateBoardGainUI();
                  showToast('Money tile (no effect in demo)');
                } else {
                  var gain = bet * energyPerBet;
                  state.energy = (state.energy || 0) + gain;
                  state.lastGain = { type: 'energy', qty: gain };
                  updateBoardGainUI();
                  if (_gainHideTid) clearTimeout(_gainHideTid);
                  _gainHideTid = setTimeout(function() { state.lastGain = null; updateBoardGainUI(); _gainHideTid = null; }, 2500);
                  if (typeof updateEnergyUI === 'function') updateEnergyUI();
                }
                updateRollButton();
                playTokenLanding();
              }
            } finally {
              state.moving = false;
              updateRollButton();
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

  function updateBoardGainUI() {
    var wrap = document.getElementById('board-gain');
    if (!wrap) return;
    var lastGain = state.lastGain;
    if (lastGain) {
      if (lastGain.type === 'dice') {
        wrap.innerHTML = '<span class="board-gain-content">Dice \u00D7' + (lastGain.qty || 0) + '</span>';
        return;
      }
      if (lastGain.type === 'energy') {
        wrap.innerHTML = '<span class="board-gain-content">Energy +' + (lastGain.qty || 0) + '</span>';
        return;
      }
    }
    wrap.innerHTML = '<span class="board-gain-placeholder">\u2014</span>';
  }

  function updateDiceResultUI() {
    var el = document.getElementById('board-dice-result');
    var valueEl = document.getElementById('board-dice-value');
    if (!el || !valueEl) return;
    if (state.moving && state.lastRollSteps != null) {
      if (state.lastRollDice && state.lastRollDice.length >= 2) {
        valueEl.textContent = state.lastRollDice[0] + ' + ' + state.lastRollDice[1] + ' = ' + state.lastRollSteps;
      } else {
        valueEl.textContent = state.lastRollSteps;
      }
      el.classList.remove('hidden');
      el.classList.add('visible');
    } else {
      el.classList.add('hidden');
      el.classList.remove('visible');
    }
  }

  function cycleBet() {
    var idx = BET_OPTIONS.indexOf(state.bet);
    var next = BET_OPTIONS[(idx + 1) % BET_OPTIONS.length];
    state.bet = next;
    updateBetUI();
    updateRollButton();
  }

  function updateBetUI() {
    var btn = document.getElementById('bet-cycle-btn');
    if (btn) {
      btn.textContent = '\u00D7' + state.bet;
      btn.disabled = state.dice < (DICE_PER_ROLL || 2);
    }
  }

  function gmAddDice() {
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
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._tid);
    toast._tid = setTimeout(function() { toast.classList.add('hidden'); }, duration);
  }

  global.pathIndexAt = pathIndexAt;
  global.initBoard = initBoard;
  global.updatePlayerToken = updatePlayerToken;
  global.updateBoardCamera = updateBoardCamera;
  global.updateCurrentTileHighlight = updateCurrentTileHighlight;
  global.rollDice = rollDice;
  global.playTokenLanding = playTokenLanding;
  global.updateRollButton = updateRollButton;
  global.updateBoardGainUI = updateBoardGainUI;
  global.updateDiceResultUI = updateDiceResultUI;
  global.cycleBet = cycleBet;
  global.updateBetUI = updateBetUI;
  global.gmAddDice = gmAddDice;
  global.updateDiceUI = updateDiceUI;
  global.showToast = showToast;
})(typeof window !== 'undefined' ? window : this);
