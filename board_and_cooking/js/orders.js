/**
 * Board & Cooking - 订单模块（依赖 config.js, state.js, items.js, board.js, modals.js）
 */
(function(global) {

  function formatReward(reward) {
    if (!reward) return '';
    var parts = [];
    if (reward.dice) parts.push('🎲 骰子 ×' + reward.dice);
    return parts.length ? parts.join('、') : '';
  }

  function renderTownMap() {
    var map = document.getElementById('town-map');
    map.innerHTML = '';
    NPCS.forEach(function(npc) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'npc-avatar' + (state.selectedNpcId === npc.id ? ' selected' : '');
      btn.dataset.npcId = npc.id;
      btn.textContent = npc.emoji;
      btn.addEventListener('click', function() { selectNpc(npc.id); });
      map.appendChild(btn);
    });
    if (state.selectedNpcId) {
      renderOrderDetail(state.selectedNpcId);
    } else {
      document.querySelector('.no-order').classList.remove('hidden');
      document.getElementById('order-content').classList.add('hidden');
    }
  }

  function selectNpc(npcId) {
    state.selectedNpcId = state.selectedNpcId === npcId ? null : npcId;
    document.querySelectorAll('.npc-avatar').forEach(function(el) {
      el.classList.toggle('selected', el.dataset.npcId === state.selectedNpcId);
    });
    if (state.selectedNpcId) {
      renderOrderDetail(state.selectedNpcId);
    } else {
      document.querySelector('.no-order').classList.remove('hidden');
      document.getElementById('order-content').classList.add('hidden');
    }
  }

  function renderOrderDetail(npcId) {
    var npc = NPCS.find(function(n) { return n.id === npcId; });
    if (!npc) return;
    document.querySelector('.no-order').classList.add('hidden');
    var content = document.getElementById('order-content');
    content.classList.remove('hidden');
    document.getElementById('order-npc-name').textContent = npc.emoji + ' ' + npc.name + ' 的订单';
    var rewardText = formatReward(npc.order.reward);
    var rewardEl = document.getElementById('order-reward');
    if (rewardEl) {
      rewardEl.textContent = '完成可获得：' + (rewardText || '无');
      rewardEl.classList.toggle('hidden', !rewardText);
    }
    var ul = document.getElementById('order-requirements');
    ul.innerHTML = '';
    var canSubmit = true;
    npc.order.items.forEach(function(need) {
      var have = getInv(need.id);
      var ok = have >= need.n;
      if (!ok) canSubmit = false;
      var showDetail = !ok && !isBaseItem(need.id) && getRecipeForItem(need.id);
      var li = document.createElement('li');
      li.className = 'order-req-row';
      li.innerHTML = '<span class="' + (ok ? 'ok' : 'need') + '">' + getItemName(need.id) + ' ×' + need.n + '</span> ' + (ok ? '✓' : '(已有' + have + ')');
      if (showDetail) {
        var detailBtn = document.createElement('button');
        detailBtn.type = 'button';
        detailBtn.className = 'btn-detail-inline';
        detailBtn.textContent = '详情';
        detailBtn.onclick = function() { openRecipeDetail(need.id); };
        li.appendChild(detailBtn);
      }
      ul.appendChild(li);
    });
    var btn = document.getElementById('btn-submit-order');
    btn.disabled = !canSubmit;
    btn.onclick = function() { submitOrder(npcId); };
  }

  function submitOrder(npcId) {
    var npc = NPCS.find(function(n) { return n.id === npcId; });
    if (!npc) return;
    for (var i = 0; i < npc.order.items.length; i++) {
      var need = npc.order.items[i];
      if (!subInv(need.id, need.n)) return;
    }
    if (npc.order.reward.dice) {
      state.dice += npc.order.reward.dice;
      updateDiceUI();
      showToast('完成订单！获得 ' + npc.order.reward.dice + ' 个骰子');
    }
    state.selectedNpcId = null;
    renderTownMap();
  }

  global.formatReward = formatReward;
  global.renderTownMap = renderTownMap;
  global.selectNpc = selectNpc;
  global.renderOrderDetail = renderOrderDetail;
  global.submitOrder = submitOrder;
})(typeof window !== 'undefined' ? window : this);
