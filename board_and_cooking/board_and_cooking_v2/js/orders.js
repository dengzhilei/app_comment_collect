/**
 * Board & Cooking - 订单模块 v2（依赖 config.js, state.js, items.js, board.js, modals.js）
 * 随机订单生成、NPC 池轮换、未解锁物品显示 ???
 */
(function(global) {

  function formatReward(reward) {
    if (!reward) return '';
    var parts = [];
    if (reward.dice) parts.push('🎲 骰子 ×' + reward.dice);
    if (reward.exp) parts.push('⭐ 经验 +' + reward.exp);
    return parts.length ? parts.join('、') : '';
  }

  function addOrderExpAndLevelUp(exp) {
    if (!exp || exp <= 0) return;
    state.chefExp = (state.chefExp || 0) + exp;
    var level = state.chefLevel || 1;
    var thresholds = CHEF_EXP_THRESHOLDS || [];
    while (level < 4 && thresholds[level - 1] != null && state.chefExp >= thresholds[level - 1]) {
      level++;
      state.chefLevel = level;
      if (typeof showLevelUpModal === 'function') showLevelUpModal(level);
      else showToast('恭喜！厨师等级提升至 Lv' + level);
    }
    state.chefLevel = level;
  }

  /** v4：当前等级下可被订单要求的物品及权重（配置 ORDER_WEIGHT_SAME_LEVEL / ORDER_WEIGHT_OTHER / ORDER_WEIGHT_BY_UNLOCK_LEVEL） */
  function getUnlockedOrderableItems() {
    var list = [];
    var level = state.chefLevel || 1;
    var maxByChain = CHEF_LEVEL_CHAIN_MAX && CHEF_LEVEL_CHAIN_MAX[level];
    var weightSame = (typeof ORDER_WEIGHT_SAME_LEVEL !== 'undefined' && ORDER_WEIGHT_SAME_LEVEL != null) ? ORDER_WEIGHT_SAME_LEVEL : 12;
    var weightOther = (typeof ORDER_WEIGHT_OTHER !== 'undefined' && ORDER_WEIGHT_OTHER != null) ? ORDER_WEIGHT_OTHER : 5;
    var byUnlock = typeof ORDER_WEIGHT_BY_UNLOCK_LEVEL !== 'undefined' ? ORDER_WEIGHT_BY_UNLOCK_LEVEL : null;
    function weightFor(unlockLv) {
      if (unlockLv === level) return weightSame;
      if (byUnlock && byUnlock[unlockLv] != null) return byUnlock[unlockLv];
      return weightOther;
    }
    for (var key in CHAINS) {
      var chain = CHAINS[key];
      var maxLv = (maxByChain && maxByChain[key]) || 0;
      chain.forEach(function(item, idx) {
        if ((idx + 1) > maxLv) return;
        var unlockLv = typeof getUnlockChefLevelForItem === 'function' ? getUnlockChefLevelForItem(item.id) : 1;
        list.push({ id: item.id, weight: weightFor(unlockLv) });
      });
    }
    (CROSS_RECIPES || []).forEach(function(r) {
      if ((r.unlockChefLevel != null ? r.unlockChefLevel : 1) > level) return;
      var unlockLv = r.unlockChefLevel != null ? r.unlockChefLevel : 1;
      list.push({ id: r.id, weight: weightFor(unlockLv) });
    });
    return list;
  }

  function weightedPick(list) {
    var total = list.reduce(function(s, x) { return s + x.weight; }, 0);
    if (total <= 0) return null;
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) {
      r -= list[i].weight;
      if (r <= 0) return list[i].id;
    }
    return list[list.length - 1].id;
  }

  /** v4：生成一笔随机订单，奖励由订单所需物品总价值动态计算 */
  function generateOneOrder() {
    var pool = getUnlockedOrderableItems();
    if (pool.length === 0) return { items: [{ id: BASE_ITEM_IDS[0] || 'wheat', n: 1 }], reward: { dice: 2, exp: 8 } };
    var numItems = 1 + Math.floor(Math.random() * 3);
    var items = [];
    var used = {};
    for (var i = 0; i < numItems && pool.length > 0; i++) {
      var id = weightedPick(pool);
      if (!id || used[id]) continue;
      used[id] = true;
      var n = 1 + Math.floor(Math.random() * 2);
      items.push({ id: id, n: n });
    }
    if (items.length === 0) items.push({ id: pool[0].id, n: 1 });
    var totalValue = 0;
    var getVal = typeof getItemValue === 'function' ? getItemValue : function() { return 1; };
    items.forEach(function(it) { totalValue += getVal(it.id) * (it.n || 1); });
    var diceBase = (typeof REWARD_DICE_BASE !== 'undefined' && REWARD_DICE_BASE != null) ? REWARD_DICE_BASE : 1;
    var dicePer = (typeof REWARD_DICE_PER_VALUE !== 'undefined' && REWARD_DICE_PER_VALUE != null) ? REWARD_DICE_PER_VALUE : 0.8;
    var expBase = (typeof REWARD_EXP_BASE !== 'undefined' && REWARD_EXP_BASE != null) ? REWARD_EXP_BASE : 4;
    var expPer = (typeof REWARD_EXP_PER_VALUE !== 'undefined' && REWARD_EXP_PER_VALUE != null) ? REWARD_EXP_PER_VALUE : 0.6;
    var dice = Math.max(1, diceBase + Math.floor(totalValue * dicePer));
    var exp = Math.max(1, expBase + Math.floor(totalValue * expPer));
    return { items: items, reward: { dice: dice, exp: exp } };
  }

  function pickRandomNpc() {
    var pool = NPC_POOL || [];
    if (pool.length === 0) return { id: 'npc0', name: '客人', emoji: '🧑' };
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function ensureActiveOrders() {
    var target = ORDER_VISIBLE_COUNT != null ? ORDER_VISIBLE_COUNT : 4;
    state.activeOrders = state.activeOrders || [];
    while (state.activeOrders.length < target) {
      state.activeOrders.push({
        npc: pickRandomNpc(),
        order: generateOneOrder()
      });
    }
  }

  /** 默认选中的订单槽位：选中第一个 */
  function getDefaultSelectedOrderSlot() {
    var orders = state.activeOrders || [];
    return orders.length > 0 ? 0 : null;
  }

  function renderTownMap() {
    ensureActiveOrders();
    var orders = state.activeOrders || [];
    if (state.selectedOrderSlot == null || state.selectedOrderSlot < 0 || state.selectedOrderSlot >= orders.length) {
      state.selectedOrderSlot = getDefaultSelectedOrderSlot();
    }
    var map = document.getElementById('town-map');
    map.innerHTML = '';
    orders.forEach(function(slot, idx) {
      var wrap = document.createElement('button');
      wrap.type = 'button';
      wrap.className = 'npc-slot-wrap' + (state.selectedOrderSlot === idx ? ' selected' : '');
      wrap.dataset.slotIndex = idx;
      var canDeliver = slot.order && slot.order.items.every(function(need) { return getInv(need.id) >= (need.n || 1); });
      var avatar = document.createElement('span');
      avatar.className = 'npc-avatar' + (canDeliver ? ' deliverable' : '');
      avatar.textContent = slot.npc.emoji;
      if (canDeliver) {
        var badge = document.createElement('span');
        badge.className = 'npc-avatar-badge';
        badge.textContent = '✓';
        avatar.appendChild(badge);
      }
      wrap.appendChild(avatar);
      var nameEl = document.createElement('span');
      nameEl.className = 'npc-slot-name';
      nameEl.textContent = slot.npc.name;
      wrap.appendChild(nameEl);
      wrap.addEventListener('click', function() { selectOrderSlot(idx); });
      map.appendChild(wrap);
    });
    if (state.selectedOrderSlot != null && orders[state.selectedOrderSlot]) {
      renderOrderDetail(state.selectedOrderSlot);
    } else {
      document.querySelector('.no-order').classList.remove('hidden');
      document.getElementById('order-content').classList.add('hidden');
    }
  }

  function selectOrderSlot(slotIndex) {
    state.selectedOrderSlot = state.selectedOrderSlot === slotIndex ? null : slotIndex;
    document.querySelectorAll('.npc-slot-wrap').forEach(function(el) {
      el.classList.toggle('selected', parseInt(el.dataset.slotIndex, 10) === state.selectedOrderSlot);
    });
    if (state.selectedOrderSlot != null) {
      renderOrderDetail(state.selectedOrderSlot);
    } else {
      document.querySelector('.no-order').classList.remove('hidden');
      document.getElementById('order-content').classList.add('hidden');
    }
  }

  function renderOrderDetail(slotIndex) {
    var slot = state.activeOrders && state.activeOrders[slotIndex];
    if (!slot) return;
    var order = slot.order;
    document.querySelector('.no-order').classList.add('hidden');
    var content = document.getElementById('order-content');
    content.classList.remove('hidden');
    var demandEl = document.getElementById('order-demand-line');
    if (demandEl) {
      var parts = [];
      order.items.forEach(function(need) {
        var have = getInv(need.id);
        var ok = have >= (need.n || 1);
        var known = isItemKnownToPlayer(need.id);
        var info = getItemInfo(need.id);
        var nameStr = known ? info.name : '???';
        var needN = need.n || 1;
        var span = document.createElement('span');
        span.className = 'order-req-inline' + (ok ? ' done' : '');
        span.innerHTML = info.emoji + nameStr + '(' + have + '/' + needN + ')';
        parts.push(span);
        if (known && !isBaseItem(need.id) && (CROSS_RECIPES || []).some(function(r) { return r.id === need.id; })) {
          var detailBtn = document.createElement('button');
          detailBtn.type = 'button';
          detailBtn.className = 'btn-detail-inline';
          detailBtn.textContent = '详情';
          detailBtn.onclick = function() { openRecipeDetail(need.id); };
          parts.push(detailBtn);
        }
      });
      demandEl.innerHTML = '';
      demandEl.appendChild(document.createTextNode('需求：'));
      parts.forEach(function(node) { demandEl.appendChild(node); demandEl.appendChild(document.createTextNode(' ')); });
    }
    var rewardEl = document.getElementById('order-reward');
    if (rewardEl) {
      var rewardText = formatReward(order.reward);
      rewardEl.textContent = '奖励：' + (rewardText || '无');
      rewardEl.classList.toggle('hidden', !rewardText);
    }
    var canSubmit = order.items.every(function(need) { return getInv(need.id) >= (need.n || 1); });
    var btn = document.getElementById('btn-submit-order');
    if (btn) {
      btn.disabled = !canSubmit;
      btn.onclick = function() { submitOrder(slotIndex); };
    }
  }

  function submitOrder(slotIndex) {
    var slot = state.activeOrders && state.activeOrders[slotIndex];
    if (!slot) return;
    var order = slot.order;
    for (var i = 0; i < order.items.length; i++) {
      var need = order.items[i];
      if (!subInv(need.id, need.n)) return;
    }
    if (order.reward.dice) {
      state.dice += order.reward.dice;
      updateDiceUI();
    }
    if (order.reward.exp) {
      addOrderExpAndLevelUp(order.reward.exp);
      if (typeof updateChefUI === 'function') updateChefUI();
    }
    var msg = '完成订单！';
    if (order.reward.dice) msg += ' 获得 ' + order.reward.dice + ' 个骰子';
    if (order.reward.exp) msg += '、' + order.reward.exp + ' 经验';
    showToast(msg);
    state.activeOrders[slotIndex] = { npc: pickRandomNpc(), order: generateOneOrder() };
    state.selectedOrderSlot = null;
    renderTownMap();
    if (typeof renderMakingDesk === 'function') renderMakingDesk();
  }

  global.formatReward = formatReward;
  global.renderTownMap = renderTownMap;
  global.selectOrderSlot = selectOrderSlot;
  global.selectNpc = selectOrderSlot;
  global.renderOrderDetail = renderOrderDetail;
  global.submitOrder = submitOrder;
  global.generateOneOrder = generateOneOrder;
  global.ensureActiveOrders = ensureActiveOrders;
})(typeof window !== 'undefined' ? window : this);
