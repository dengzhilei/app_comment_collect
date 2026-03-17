/**
 * Board & Merge - orders (fulfill from merge grid, chain items only)
 */
(function(global) {

  function formatReward(reward) {
    if (!reward) return '';
    var parts = [];
    if (reward.dice) parts.push('Dice x' + reward.dice);
    if (reward.exp) parts.push('Exp +' + reward.exp);
    return parts.length ? parts.join(', ') : '';
  }

  function addOrderExpAndLevelUp(exp) {
    if (!exp || exp <= 0) return;
    state.chefExp = (state.chefExp || 0) + exp;
    var level = state.chefLevel || 1;
    var thresholds = CHEF_EXP_THRESHOLDS || [];
    while (level < 4 && thresholds[level - 1] != null && state.chefExp >= thresholds[level - 1]) {
      level++;
      state.chefLevel = level;
      if (typeof showToast === 'function') showToast('Level up! Lv.' + level);
    }
    state.chefLevel = level;
  }

  function getUnlockedOrderableItems() {
    var list = [];
    var level = state.chefLevel || 1;
    var maxByChain = CHEF_LEVEL_CHAIN_MAX && CHEF_LEVEL_CHAIN_MAX[level];
    var weightSame = (typeof ORDER_WEIGHT_SAME_LEVEL !== 'undefined' && ORDER_WEIGHT_SAME_LEVEL != null) ? ORDER_WEIGHT_SAME_LEVEL : 12;
    var weightOther = (typeof ORDER_WEIGHT_OTHER !== 'undefined' && ORDER_WEIGHT_OTHER != null) ? ORDER_WEIGHT_OTHER : 5;
    for (var key in CHAINS) {
      var chain = CHAINS[key];
      var maxLv = (maxByChain && maxByChain[key]) || 0;
      chain.forEach(function(item, idx) {
        if ((idx + 1) > maxLv) return;
        var unlockLv = typeof getUnlockChefLevelForItem === 'function' ? getUnlockChefLevelForItem(item.id) : 1;
        list.push({ id: item.id, weight: unlockLv === level ? weightSame : weightOther });
      });
    }
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

  function generateOneOrder() {
    var pool = getUnlockedOrderableItems();
    if (pool.length === 0) return { items: [{ id: BASE_ITEM_IDS[0] || 'wheat', n: 1 }], reward: { dice: 2, exp: 8 } };
    var numItems = 1 + Math.floor(Math.random() * 2);
    var items = [];
    var used = {};
    for (var i = 0; i < numItems && pool.length > 0; i++) {
      var id = weightedPick(pool);
      if (!id || used[id]) continue;
      used[id] = true;
      items.push({ id: id, n: 1 });
    }
    if (items.length === 0) items.push({ id: pool[0].id, n: 1 });
    var totalValue = 0;
    var getVal = typeof getItemValue === 'function' ? getItemValue : function() { return 1; };
    items.forEach(function(it) { totalValue += getVal(it.id) * (it.n || 1); });
    var dice = Math.max(1, (typeof REWARD_DICE_BASE !== 'undefined' ? REWARD_DICE_BASE : 1) + Math.floor(totalValue * (typeof REWARD_DICE_PER_VALUE !== 'undefined' ? REWARD_DICE_PER_VALUE : 0.8)));
    var exp = Math.max(1, (typeof REWARD_EXP_BASE !== 'undefined' ? REWARD_EXP_BASE : 4) + Math.floor(totalValue * (typeof REWARD_EXP_PER_VALUE !== 'undefined' ? REWARD_EXP_PER_VALUE : 0.6)));
    return { items: items, reward: { dice: dice, exp: exp } };
  }

  function pickRandomNpc() {
    var pool = NPC_POOL || [];
    if (pool.length === 0) return { id: 'npc0', name: 'Customer', emoji: '\uD83E\uDDD1' };
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

  function getDefaultSelectedOrderSlot() {
    var orders = state.activeOrders || [];
    return orders.length > 0 ? 0 : null;
  }

  function renderTownMap() {
    ensureActiveOrders();
    var orders = state.activeOrders || [];
    var listEl = document.getElementById('order-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    listEl.className = 'order-list order-list-cols';
    orders.forEach(function(slot, idx) {
      var order = slot.order;
      var canSubmit = order.items.every(function(need) { return getInv(need.id) >= (need.n || 1); });
      var card = document.createElement('div');
      card.className = 'order-card-col' + (canSubmit ? ' deliverable' : '');
      var portraitWrap = document.createElement('div');
      portraitWrap.className = 'order-card-portrait-wrap';
      var avatar = document.createElement('div');
      avatar.className = 'order-card-portrait' + (canSubmit ? ' deliverable' : '');
      if (slot.npc.img) {
        var pImg = document.createElement('img');
        pImg.className = 'order-card-portrait-img';
        pImg.src = slot.npc.img;
        pImg.alt = slot.npc.name;
        pImg.onerror = function() { avatar.textContent = slot.npc.emoji || ''; };
        avatar.appendChild(pImg);
      } else {
        avatar.textContent = slot.npc.emoji || '';
      }
      if (canSubmit) {
        var badge = document.createElement('span');
        badge.className = 'npc-avatar-badge';
        badge.textContent = '\u2713';
        avatar.appendChild(badge);
      }
      portraitWrap.appendChild(avatar);
      card.appendChild(portraitWrap);
      var r = order.reward || {};
      var rewardBubble = document.createElement('div');
      rewardBubble.className = 'order-card-reward-bubble';
      rewardBubble.textContent = (r.dice != null ? r.dice : 0) + '\uD83C\uDFB2 ' + (r.exp != null ? r.exp : 0) + '\u2B50';
      card.appendChild(rewardBubble);
      var itemsWrap = document.createElement('div');
      itemsWrap.className = 'order-card-items-col';
      order.items.forEach(function(need) {
        var have = getInv(need.id);
        var needN = need.n || 1;
        var ok = have >= needN;
        var info = getItemInfo(need.id);
        var isBase = typeof isBaseItem === 'function' ? isBaseItem(need.id) : true;
        var showChain = !isBase && !ok && typeof showChainModal === 'function';
        var itemBlock = document.createElement('div');
        itemBlock.className = 'order-item-block' + (ok ? ' done' : '') + (showChain ? ' has-chain' : '');
        if (showChain) {
          itemBlock.title = '点击查看合成链';
          itemBlock.style.cursor = 'pointer';
          itemBlock.addEventListener('click', function(e) { e.stopPropagation(); showChainModal(need.id); });
        }
        if (info.img) {
          var oImg = document.createElement('img');
          oImg.className = 'order-item-block-img';
          oImg.src = info.img;
          oImg.alt = info.name;
          oImg.title = info.name;
          oImg.onerror = function() {
            this.style.display = 'none';
            var sp = document.createElement('span');
            sp.className = 'order-item-block-emoji';
            sp.textContent = info.emoji || '';
            itemBlock.appendChild(sp);
          };
          itemBlock.appendChild(oImg);
        } else {
          itemBlock.classList.add('use-emoji');
          itemBlock.setAttribute('data-emoji', info.emoji || '');
          itemBlock.textContent = info.emoji || '';
        }
        var countEl = document.createElement('span');
        countEl.className = 'order-item-block-count';
        countEl.textContent = have + '/' + needN;
        itemBlock.appendChild(countEl);
        if (showChain) {
          var iBadge = document.createElement('span');
          iBadge.className = 'order-item-block-i';
          iBadge.textContent = 'i';
          iBadge.setAttribute('aria-hidden', 'true');
          itemBlock.appendChild(iBadge);
        }
        itemsWrap.appendChild(itemBlock);
      });
      card.appendChild(itemsWrap);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-submit order-card-btn-col';
      btn.textContent = '\u4EA4\u4ED8';
      btn.disabled = !canSubmit;
      btn.addEventListener('click', function() { submitOrder(idx); });
      card.appendChild(btn);
      listEl.appendChild(card);
    });
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
      if (typeof updateDiceUI === 'function') updateDiceUI();
    }
    if (order.reward.exp) {
      addOrderExpAndLevelUp(order.reward.exp);
      if (typeof updateChefUI === 'function') updateChefUI();
    }
    showToast('Order done! Dice +' + (order.reward.dice || 0) + ', Exp +' + (order.reward.exp || 0));
    state.activeOrders[slotIndex] = { npc: pickRandomNpc(), order: generateOneOrder() };
    renderTownMap();
    if (typeof renderMergeGrid === 'function') renderMergeGrid();
  }

  function showChainModal(itemId) {
    var chainItems = typeof getChainSliceForItem === 'function' ? getChainSliceForItem(itemId) : [];
    var info = getItemInfo(itemId);
    var titleEl = document.getElementById('modal-chain-title');
    var stripEl = document.getElementById('modal-chain-strip');
    var modal = document.getElementById('modal-chain');
    if (!modal || !stripEl) return;
    if (titleEl) titleEl.textContent = info.name + ' 合成链';
    stripEl.innerHTML = '';
    chainItems.forEach(function(item, i) {
      var cell = document.createElement('div');
      cell.className = 'modal-chain-cell';
      if (item.img) {
        var img = document.createElement('img');
        img.src = item.img;
        img.alt = item.name;
        img.className = 'modal-chain-cell-img';
        img.onerror = function() { cell.textContent = item.emoji || ''; };
        cell.appendChild(img);
      } else {
        cell.textContent = item.emoji || '';
      }
      var nameSpan = document.createElement('span');
      nameSpan.className = 'modal-chain-cell-name';
      nameSpan.textContent = item.name;
      cell.appendChild(nameSpan);
      stripEl.appendChild(cell);
      if (i < chainItems.length - 1) {
        var arrow = document.createElement('span');
        arrow.className = 'modal-chain-arrow';
        arrow.textContent = '\u2192';
        stripEl.appendChild(arrow);
      }
    });
    modal.classList.remove('hidden');
  }

  function closeChainModal() {
    var modal = document.getElementById('modal-chain');
    if (modal) modal.classList.add('hidden');
  }

  global.formatReward = formatReward;
  global.renderTownMap = renderTownMap;
  global.submitOrder = submitOrder;
  global.generateOneOrder = generateOneOrder;
  global.ensureActiveOrders = ensureActiveOrders;
  global.showChainModal = showChainModal;
  global.closeChainModal = closeChainModal;
})(typeof window !== 'undefined' ? window : this);
