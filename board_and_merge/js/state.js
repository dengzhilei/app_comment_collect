/**
 * Board & Merge - game state
 */
(function(global) {
  var gridLen = (typeof MERGE_GRID_ROWS !== 'undefined' ? MERGE_GRID_ROWS : 5) * (typeof MERGE_GRID_COLS !== 'undefined' ? MERGE_GRID_COLS : 5);
  var mergeCells = [];
  for (var i = 0; i < gridLen; i++) mergeCells.push(null);

  global.state = {
    dice: 20,
    bet: 1,
    position: 0,
    energy: 10,
    boardTiles: [],
    lastRollSteps: 0,
    lastGain: null,
    moving: false,
    lastRollDice: null,
    gmNextRollSteps: null,
    chefLevel: 4,
    chefExp: 999,
    activeOrders: [],
    selectedOrderSlot: null,
    boardQuestionIndices: null,
    mergeGrid: mergeCells
  };

  function getInv(id) {
    var count = 0;
    (state.mergeGrid || []).forEach(function(cell) {
      if (cell && cell.id === id) count++;
    });
    return count;
  }
  function addInv(id, n) { /* used by board gain feedback; merge grid is filled by generators */ }
  function subInv(id, n) {
    var left = n;
    for (var i = 0; i < state.mergeGrid.length && left > 0; i++) {
      if (state.mergeGrid[i] && state.mergeGrid[i].id === id) {
        state.mergeGrid[i] = null;
        left--;
      }
    }
    return left === 0;
  }

  global.getInv = getInv;
  global.addInv = addInv;
  global.subInv = subInv;
})(typeof window !== 'undefined' ? window : this);
