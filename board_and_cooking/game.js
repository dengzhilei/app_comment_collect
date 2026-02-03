/**
 * Board & Cooking - 游戏状态与逻辑（依赖 config.js）
 */

function pathIndexAt(r, c) {
  const i = PATH_GRID.findIndex(([pr, pc]) => pr === r && pc === c);
  return i >= 0 ? i : null;
}

// ------------------------- 状态 -------------------------
let state = {
  dice: 20,
  bet: 1,
  position: 0,
  inventory: {},
  boardTiles: [],
  selectedNpcId: null,
  currentChain: 'wheat',
  recipeDetailStack: []
};

function getInv(id) { return state.inventory[id] || 0; }
function addInv(id, n) { state.inventory[id] = (state.inventory[id] || 0) + n; }
function subInv(id, n) {
  const have = state.inventory[id] || 0;
  if (have < n) return false;
  state.inventory[id] = have - n;
  return true;
}

// ------------------------- 初始化棋盘（方形中空） -------------------------
function initBoard() {
  state.boardTiles = [];
  for (let i = 0; i < BOARD_CELLS; i++) {
    state.boardTiles.push(TILE_TYPES[i % TILE_TYPES.length]);
  }
  const board = document.getElementById('board');
  board.innerHTML = '';
  const n = HOLLOW_GRID_SIZE;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = document.createElement('div');
      const pathIdx = pathIndexAt(r, c);
      if (pathIdx === null) {
        cell.className = 'tile tile-empty';
        cell.setAttribute('aria-hidden', 'true');
      } else {
        const type = state.boardTiles[pathIdx];
        const isCurrent = state.position === pathIdx;
        cell.className = `tile ${type}${isCurrent ? ' current' : ''}`;
        cell.dataset.pathIndex = pathIdx;
        cell.textContent = TILE_EMOJI[type];
      }
      board.appendChild(cell);
    }
  }
  updatePlayerToken();
}

function updatePlayerToken() {
  const token = document.getElementById('player-token');
  const wrap = document.querySelector('.board-wrap');
  if (!wrap) return;
  const [row, col] = PATH_GRID[state.position];
  const n = HOLLOW_GRID_SIZE;
  const cellW = wrap.offsetWidth / n;
  const cellH = wrap.offsetHeight / n;
  token.style.left = (col * cellW + cellW / 2 - 20) + 'px';
  token.style.top = (row * cellH + cellH / 2 - 20) + 'px';
}

function updateCurrentTileHighlight() {
  const pathIdx = state.position;
  document.querySelectorAll('#board .tile[data-path-index]').forEach(el => {
    el.classList.toggle('current', parseInt(el.dataset.pathIndex, 10) === pathIdx);
  });
}

// ------------------------- 掷骰子（支持 bet 倍） -------------------------
function rollDice() {
  const need = state.bet;
  if (state.dice < need) {
    showToast('骰子不足，去订单完成奖励获取吧~');
    return;
  }
  state.dice -= need;
  const steps = 1 + Math.floor(Math.random() * 6);
  showToast(`掷出 ${steps} 步！消耗 ${need} 骰子`);

  let next = state.position + steps;
  const total = BOARD_CELLS;
  if (next >= total) next = next % total;
  state.position = next;

  const tileType = state.boardTiles[state.position];
  const gainId = TILE_GAIN[tileType];
  addInv(gainId, state.bet);
  const name = CHAINS.wheat.find(x => x.id === gainId)?.name || CHAINS.dairy.find(x => x.id === gainId)?.name || CHAINS.veggie.find(x => x.id === gainId)?.name || CHAINS.protein.find(x => x.id === gainId)?.name || gainId;
  showToast(`获得：${name} x${state.bet}`, 1500);

  updateDiceUI();
  updateBetUI();
  updateRollButton();
  updateCurrentTileHighlight();
  updatePlayerToken();
}

function updateRollButton() {
  const btn = document.getElementById('btn-roll');
  if (btn) btn.disabled = state.dice < state.bet;
}

function setBet(value) {
  if (BET_OPTIONS.indexOf(value) === -1) return;
  state.bet = value;
  updateBetUI();
  updateRollButton();
}

function updateBetUI() {
  const hint = document.getElementById('roll-hint');
  if (hint) hint.textContent = `消耗 ${state.bet} 个骰子，掷出 1–6 步，获得 ${state.bet} 倍材料`;
  BET_OPTIONS.forEach(v => {
    const btn = document.getElementById('bet-opt-' + v);
    if (!btn) return;
    btn.classList.toggle('active', state.bet === v);
    btn.disabled = state.dice < v;
  });
}

function gmAddDice() {
  state.dice += 20;
  updateDiceUI();
  updateBetUI();
  updateRollButton();
  showToast('GM +20 骰子');
}

// ------------------------- UI 更新 -------------------------
function updateDiceUI() {
  const el = document.getElementById('dice-num');
  if (el) el.textContent = state.dice;
  if (state.bet > state.dice) {
    const allowed = BET_OPTIONS.filter(x => x <= state.dice);
    state.bet = allowed.length ? Math.max(...allowed) : BET_OPTIONS[0];
  }
  updateBetUI();
  updateRollButton();
}

function showToast(msg, duration = 1200) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._tid);
  toast._tid = setTimeout(() => { toast.classList.add('hidden'); }, duration);
}

// ------------------------- 标签页切换 -------------------------
function switchTab(tabId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById('panel-' + tabId);
  const tab = document.querySelector('.tab[data-tab="' + tabId + '"]');
  if (panel) panel.classList.add('active');
  if (tab) tab.classList.add('active');

  if (tabId === 'board') {
    setTimeout(updatePlayerToken, 50);
    updateBetUI();
  }
  if (tabId === 'orders') renderTownMap();
  if (tabId === 'craft') renderCraftChain(state.currentChain);
}

// ------------------------- 背包弹窗（v5：链分行 + 交叉最后） -------------------------
function openInventory() {
  const list = document.getElementById('inventory-list');
  list.innerHTML = '';
  const chainKeys = ['wheat', 'dairy', 'veggie', 'protein'];
  const chainLabels = { wheat: '主食', dairy: '乳制品', veggie: '蔬菜', protein: '蛋白质' };
  chainKeys.forEach(chainKey => {
    const chain = CHAINS[chainKey];
    const itemsWithCount = chain.filter(item => getInv(item.id) > 0);
    if (itemsWithCount.length === 0) return;
    const section = document.createElement('div');
    section.className = 'inv-chain-row';
    const label = document.createElement('div');
    label.className = 'inv-chain-label';
    label.textContent = chainLabels[chainKey] || chainKey;
    section.appendChild(label);
    const wrap = document.createElement('div');
    wrap.className = 'inv-chain-items';
    itemsWithCount.forEach(item => {
      const count = getInv(item.id);
      const div = document.createElement('div');
      div.className = 'inv-item';
      div.innerHTML = `<span>${item.emoji}</span><span>${item.name}</span><span class="count">×${count}</span>`;
      wrap.appendChild(div);
    });
    section.appendChild(wrap);
    list.appendChild(section);
  });
  const crossWithCount = CROSS_RECIPES.filter(rec => getInv(rec.id) > 0);
  if (crossWithCount.length > 0) {
    const section = document.createElement('div');
    section.className = 'inv-chain-row inv-cross-row';
    const label = document.createElement('div');
    label.className = 'inv-chain-label';
    label.textContent = '合成物品';
    section.appendChild(label);
    const wrap = document.createElement('div');
    wrap.className = 'inv-chain-items';
    crossWithCount.forEach(rec => {
      const count = getInv(rec.id);
      const div = document.createElement('div');
      div.className = 'inv-item inv-item-cross';
      div.innerHTML = `<span>${rec.emoji}</span><span>${rec.name}</span><span class="count">×${count}</span>`;
      wrap.appendChild(div);
    });
    section.appendChild(wrap);
    list.appendChild(section);
  }
  document.getElementById('modal-inventory').classList.remove('hidden');
}

function closeInventory() {
  document.getElementById('modal-inventory').classList.add('hidden');
}

// ------------------------- 订单模块 -------------------------
function renderTownMap() {
  const map = document.getElementById('town-map');
  map.innerHTML = '';
  NPCS.forEach(npc => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'npc-avatar' + (state.selectedNpcId === npc.id ? ' selected' : '');
    btn.dataset.npcId = npc.id;
    btn.textContent = npc.emoji;
    btn.addEventListener('click', () => selectNpc(npc.id));
    map.appendChild(btn);
  });
  if (state.selectedNpcId) renderOrderDetail(state.selectedNpcId);
  else {
    document.querySelector('.no-order').classList.remove('hidden');
    document.getElementById('order-content').classList.add('hidden');
  }
}

function selectNpc(npcId) {
  state.selectedNpcId = state.selectedNpcId === npcId ? null : npcId;
  document.querySelectorAll('.npc-avatar').forEach(el => {
    el.classList.toggle('selected', el.dataset.npcId === state.selectedNpcId);
  });
  if (state.selectedNpcId) renderOrderDetail(state.selectedNpcId);
  else {
    document.querySelector('.no-order').classList.remove('hidden');
    document.getElementById('order-content').classList.add('hidden');
  }
}

function getItemInfo(id) {
  for (const chain of Object.values(CHAINS)) {
    const f = chain.find(x => x.id === id);
    if (f) return { name: f.name, emoji: f.emoji };
  }
  const c = CROSS_RECIPES.find(r => r.id === id);
  if (c) return { name: c.name, emoji: c.emoji };
  return { name: id, emoji: '📦' };
}

function getItemName(id) {
  const info = getItemInfo(id);
  return info.emoji + ' ' + info.name;
}

function getChainForItem(itemId) {
  for (const [key, chain] of Object.entries(CHAINS)) {
    if (chain.some(x => x.id === itemId)) return key;
  }
  return null;
}

function canCraftItem(itemId) {
  const chainKey = getChainForItem(itemId);
  if (chainKey) {
    const recipe = CHAIN_RECIPES[itemId];
    if (recipe) return getInv(recipe.from) >= recipe.count;
  }
  const cross = CROSS_RECIPES.find(r => r.id === itemId);
  if (cross) return cross.needs.every(n => getInv(n.id) >= n.n);
  return false;
}

function isBaseItem(itemId) {
  return BASE_ITEM_IDS.indexOf(itemId) !== -1;
}

/** 获取物品合成配方，基础物品返回 null */
function getRecipeForItem(itemId) {
  if (isBaseItem(itemId)) return null;
  const recipe = CHAIN_RECIPES[itemId];
  if (recipe) return { type: 'chain', ingredients: [{ id: recipe.from, n: recipe.count }], resultId: itemId };
  const cross = CROSS_RECIPES.find(r => r.id === itemId);
  if (cross) return { type: 'cross', ingredients: cross.needs.map(n => ({ id: n.id, n: n.n })), resultId: itemId };
  return null;
}

function formatReward(reward) {
  if (!reward) return '';
  const parts = [];
  if (reward.dice) parts.push('🎲 骰子 ×' + reward.dice);
  return parts.length ? parts.join('、') : '';
}

function renderOrderDetail(npcId) {
  const npc = NPCS.find(n => n.id === npcId);
  if (!npc) return;
  document.querySelector('.no-order').classList.add('hidden');
  const content = document.getElementById('order-content');
  content.classList.remove('hidden');
  document.getElementById('order-npc-name').textContent = npc.emoji + ' ' + npc.name + ' 的订单';
  const rewardText = formatReward(npc.order.reward);
  const rewardEl = document.getElementById('order-reward');
  if (rewardEl) {
    rewardEl.textContent = '完成可获得：' + (rewardText || '无');
    rewardEl.classList.toggle('hidden', !rewardText);
  }
  const ul = document.getElementById('order-requirements');
  ul.innerHTML = '';
  let canSubmit = true;
  npc.order.items.forEach(need => {
    const have = getInv(need.id);
    const ok = have >= need.n;
    if (!ok) canSubmit = false;
    const showDetail = !ok && !isBaseItem(need.id) && getRecipeForItem(need.id);
    const li = document.createElement('li');
    li.className = 'order-req-row';
    li.innerHTML = `<span class="${ok ? 'ok' : 'need'}">${getItemName(need.id)} ×${need.n}</span> ${ok ? '✓' : '(已有' + have + ')'}`;
    if (showDetail) {
      const detailBtn = document.createElement('button');
      detailBtn.type = 'button';
      detailBtn.className = 'btn-detail-inline';
      detailBtn.textContent = '详情';
      detailBtn.onclick = () => openRecipeDetail(need.id);
      li.appendChild(detailBtn);
    }
    ul.appendChild(li);
  });
  const btn = document.getElementById('btn-submit-order');
  btn.disabled = !canSubmit;
  btn.onclick = () => submitOrder(npcId);
}

function submitOrder(npcId) {
  const npc = NPCS.find(n => n.id === npcId);
  if (!npc) return;
  for (const need of npc.order.items) {
    if (!subInv(need.id, need.n)) return;
  }
  if (npc.order.reward.dice) {
    state.dice += npc.order.reward.dice;
    updateDiceUI();
    showToast(`完成订单！获得 ${npc.order.reward.dice} 个骰子`);
  }
  state.selectedNpcId = null;
  renderTownMap();
}

// ------------------------- 制作模块（可复用到弹窗） -------------------------
function getRecipeFromItemId(itemId) {
  const recipe = CHAIN_RECIPES[itemId];
  if (recipe) return getItemInfo(recipe.from).name;
  return '';
}

function fillCraftContainers(chainKey, chainContainer, crossContainer, afterCraft) {
  const chain = CHAINS[chainKey];
  if (!chain || !chainContainer) return;
  chainContainer.innerHTML = '';
  chain.forEach((item, level) => {
    const levelDiv = document.createElement('div');
    levelDiv.className = 'craft-level';
    levelDiv.innerHTML = `<span class="label">Lv${level + 1}</span>`;
    const count = getInv(item.id);
    const span = document.createElement('span');
    span.className = 'craft-item';
    span.innerHTML = `${item.emoji} ${item.name} <span class="count">×${count}</span>`;
    levelDiv.appendChild(span);
    const recipe = CHAIN_RECIPES[item.id];
    if (recipe) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-craft';
      const fromName = getRecipeFromItemId(item.id) || recipe.from;
      btn.textContent = `合成(需${recipe.count}${fromName})`;
      btn.disabled = getInv(recipe.from) < recipe.count;
      btn.onclick = () => {
        doChainCraft(item.id);
        if (afterCraft) afterCraft();
      };
      levelDiv.appendChild(btn);
    }
    chainContainer.appendChild(levelDiv);
  });

  if (!crossContainer) return;
  crossContainer.innerHTML = '';
  CROSS_RECIPES.forEach(rec => {
    const div = document.createElement('div');
    div.className = 'cross-recipe';
    const parts = rec.needs.map(n => getItemInfo(n.id).name + '×' + n.n).join(' + ');
    const canCraft = rec.needs.every(n => getInv(n.id) >= n.n);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-craft';
    btn.textContent = '合成';
    btn.disabled = !canCraft;
    btn.onclick = () => {
      doCrossCraft(rec.id);
      if (afterCraft) afterCraft();
    };
    div.innerHTML = `<span>${parts}</span> <span class="arrow">→</span> <span>${rec.emoji} ${rec.name}</span>`;
    div.appendChild(btn);
    crossContainer.appendChild(div);
  });
}

function renderCraftChain(chainKey) {
  state.currentChain = chainKey;
  document.querySelectorAll('.craft-tab').forEach(t => t.classList.toggle('active', t.dataset.chain === chainKey));
  fillCraftContainers(chainKey,
    document.getElementById('craft-chain'),
    document.getElementById('cross-recipes'),
    () => renderCraftChain(state.currentChain)
  );
}

// ------------------------- 配方详情弹窗（v3/v4） -------------------------
// v4：链状物品显示整条合成链；交叉合成物品保持单配方+原料详情
function openRecipeDetail(itemId) {
  state.recipeDetailStack = [itemId];
  document.getElementById('modal-recipe-detail').classList.remove('hidden');
  renderRecipeDetail();
}

function closeRecipeDetail() {
  state.recipeDetailStack = [];
  document.getElementById('modal-recipe-detail').classList.add('hidden');
}

function renderRecipeDetail() {
  const modal = document.getElementById('modal-recipe-detail');
  const titleEl = modal.querySelector('.recipe-detail-title');
  const bodyEl = modal.querySelector('.recipe-detail-body');
  const backBtn = modal.querySelector('.btn-recipe-back');
  if (!titleEl || !bodyEl) return;
  const itemId = state.recipeDetailStack[state.recipeDetailStack.length - 1];
  const recipe = getRecipeForItem(itemId);
  const info = getItemInfo(itemId);
  bodyEl.innerHTML = '';
  if (!recipe) {
    titleEl.textContent = info.emoji + ' ' + info.name;
    bodyEl.textContent = '基础物品，无需合成。';
    if (backBtn) backBtn.classList.add('hidden');
    return;
  }

  if (recipe.type === 'chain') {
    // v5：标题为目标物品；合成链显示 Lv1→Lv2→Lv3 + 箭头，高亮目标物品
    titleEl.textContent = info.emoji + ' ' + info.name;
    const chainKey = getChainForItem(itemId);
    const chain = CHAINS[chainKey];
    const flow = document.createElement('div');
    flow.className = 'recipe-detail-chain-flow';
    chain.forEach((item, index) => {
      const node = document.createElement('span');
      node.className = 'chain-node';
      if (item.id === itemId) node.classList.add('chain-target');
      const level = index + 1;
      node.textContent = `Lv${level} ${item.emoji} ${item.name}`;
      flow.appendChild(node);
      if (index < chain.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'chain-arrow';
        arrow.textContent = '→';
        flow.appendChild(arrow);
      }
    });
    bodyEl.appendChild(flow);
    if (backBtn) backBtn.classList.add('hidden');
    return;
  }

  // 交叉合成：单配方 + 原料可点详情
  titleEl.textContent = info.emoji + ' ' + info.name + ' 合成配方';
  bodyEl.appendChild(document.createTextNode('需要：'));
  const ul = document.createElement('ul');
  ul.className = 'recipe-detail-list';
  recipe.ingredients.forEach(ing => {
    const li = document.createElement('li');
    const ingInfo = getItemInfo(ing.id);
    li.appendChild(document.createTextNode(ingInfo.emoji + ' ' + ingInfo.name + ' ×' + ing.n));
    if (!isBaseItem(ing.id)) {
      const detailBtn = document.createElement('button');
      detailBtn.type = 'button';
      detailBtn.className = 'btn-detail-inline';
      detailBtn.textContent = '详情';
      detailBtn.onclick = () => {
        state.recipeDetailStack.push(ing.id);
        renderRecipeDetail();
      };
      li.appendChild(document.createTextNode(' '));
      li.appendChild(detailBtn);
    }
    ul.appendChild(li);
  });
  bodyEl.appendChild(ul);
  if (backBtn) {
    backBtn.classList.toggle('hidden', state.recipeDetailStack.length <= 1);
    backBtn.onclick = () => {
      state.recipeDetailStack.pop();
      renderRecipeDetail();
    };
  }
}

function doChainCraft(targetId) {
  const recipe = CHAIN_RECIPES[targetId];
  if (!recipe || getInv(recipe.from) < recipe.count) return;
  subInv(recipe.from, recipe.count);
  addInv(targetId, 1);
  showToast('合成成功！');
  renderCraftChain(state.currentChain);
}

function doCrossCraft(targetId) {
  const rec = CROSS_RECIPES.find(r => r.id === targetId);
  if (!rec || !rec.needs.every(n => getInv(n.id) >= n.n)) return;
  rec.needs.forEach(n => subInv(n.id, n.n));
  addInv(targetId, 1);
  showToast('合成成功！');
  renderCraftChain(state.currentChain);
}

// ------------------------- 对外暴露供 app 初始化 -------------------------
function initGame() {
  initBoard();
  updateDiceUI();
  updateBetUI();
}
