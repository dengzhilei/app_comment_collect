import csv
import random
import os
import bisect

def parse_csv(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        # 跳过前 4 行表格头部的注释行：var, type, group, desc
        headers_read = False
        headers = []
        data = []
        for i, row in enumerate(reader):
            if i == 0:
                headers = row
            if i < 4:
                continue
            if not any(row):  # 跳过空行
                continue
            doc = {}
            for j, val in enumerate(row):
                if j < len(headers) and headers[j].strip():
                    key = headers[j].strip()
                    doc[key] = val.strip()
            data.append(doc)
    return data

class AlbumSimulator:
    def __init__(self, data_dir, enable_dynamic_unlock=True, enable_weight_control=True):
        self.enable_dynamic_unlock = enable_dynamic_unlock
        self.enable_weight_control = enable_weight_control
        
        # 加载各项配置表
        self.cards = parse_csv(os.path.join(data_dir, 'album_config', 'card.csv'))
        self.cardcases = parse_csv(os.path.join(data_dir, 'album_config', 'cardcase.csv'))
        self.cardsets = parse_csv(os.path.join(data_dir, 'album_config', 'cardset.csv'))
        self.drop_expect = parse_csv(os.path.join(data_dir, 'album_config', 'drop_expect.csv'))
        self.drop_rate_change = parse_csv(os.path.join(data_dir, 'album_config', 'drop_rate_change.csv'))
        self.drop_score = parse_csv(os.path.join(data_dir, 'album_config', 'drop_score.csv'))
        self.drop_unlock = parse_csv(os.path.join(data_dir, 'album_config', 'drop_unlock.csv'))
        
        # 预处理数据
        self.cards_by_category = {}
        for c in self.cards:
            if 'card_id' not in c or not c['card_id']: continue
            cat = self._get_card_category(int(c['star']), int(c['card_type']))
            c['cat'] = cat
            self.cards_by_category.setdefault(cat, []).append(c)

        self.cases_map = {int(c['cardcase_id']): c for c in self.cardcases if 'cardcase_id' in c}
        self.score_map = {int(c['cardcase_id']): float(c['score']) for c in self.drop_score if 'cardcase_id' in c}
        self.unlock_map = {int(c['id']): int(c['unlock_num']) for c in self.drop_unlock if 'id' in c}
        
        # 期望收集张数曲线：set_id -> 期望分值列表 (对应1~9张的期待分值)
        self.expect_curves = {}
        for row in self.drop_expect:
            if 'final_expect_list' not in row or not row['final_expect_list']: continue
            set_id = int(row['id'])
            scores = [float(x) for x in row['final_expect_list'].split(',')]
            # scores 里面存的是收集 1..9 张卡所对应的目标期望分数
            self.expect_curves[set_id] = scores
            
        # 玩家状态信息
        self.player_score = 0.0
        self.collected_cards = set() # 存放已收集的 card_id
        
        # 数据统计
        self.stats_cards_drawn = 0
        self.stats_packs_opened = 0
        self.stats_duplicates = 0
        
    def _get_card_category(self, star, card_type):
        if card_type == 1:
            return {1: "OneStarCard", 2: "TwoStarCard", 3: "ThreeStarCard", 4: "FourStarCard", 5: "FiveStarCard", 6: "SixStarCard"}.get(star, "Unknown")
        elif card_type == 2:
            return {4: "FourStarGold", 5: "FiveStarGold", 6: "SixStarGold"}.get(star, "Unknown")
        return "Unknown"
        
    def get_unlocked_sets(self):
        # 如果关闭了动态卡池限制，则默认所有 Set 全部解锁
        if not self.enable_dynamic_unlock:
            return set(self.unlock_map.keys())
        
        unlocked = set()
        unique_len = len(self.collected_cards)
        for sid, req in self.unlock_map.items():
            if unique_len >= req:
                unlocked.add(sid)
        if not unlocked:
            unlocked.add(1) # 兜底逻辑：至少默认解锁基础的 Set 1
        return unlocked
        
    def get_expected_cards(self, set_id):
        if set_id not in self.expect_curves: return 0.0
        scores = self.expect_curves[set_id]
        if self.player_score <= 0: return 0.0
        if self.player_score >= scores[-1]: return 9.0
        
        # 使用二分法寻找当前分值落在哪一个张数区间
        idx = bisect.bisect_left(scores, self.player_score)
        if idx == 0:
            # 处在 0 张 (score 0) 到 1 张 (score [0]) 之间
            p0, c0 = 0, 0
            p1, c1 = scores[0], 1
        else:
            p0, c0 = scores[idx-1], idx
            p1, c1 = scores[idx], idx + 1
            
        # 根据当前分值做线性插值，算出一个带小数的期望张数
        ratio = (self.player_score - p0) / (p1 - p0)
        return c0 + ratio

    def get_set_collected_count(self, set_id):
        cnt = 0
        for c in self.cards:
            if int(c['cardset_from']) == set_id and int(c['card_id']) in self.collected_cards:
                cnt += 1
        return cnt
        
    def get_multiplier(self, c_delta, star, is_gold):
        for row in self.drop_rate_change:
            if 'delta_range_min' not in row: continue
            min_val = float(row['delta_range_min']) if row['delta_range_min'] else -9999
            max_val = float(row['delta_range_max']) if row['delta_range_max'] else 9999
            if min_val <= c_delta < max_val:
                # 获取该区间对应所有星级的加成倍率 (区分普通卡和金卡)
                list_key = 'final_change_list_gold' if is_gold else 'final_change_list'
                # 如果没有金卡列退回查找普通卡列
                if list_key not in row or not row[list_key]:
                    list_key = 'final_change_list'
                rates = [float(x) for x in row[list_key].split(',')]
                # 注意数组索引 0 表示 1 星，索引 1 表示 2 星...
                idx = star - 1 if 1 <= star <= 6 else 0
                return rates[idx]
        return 1.0

    def parse_probability_string(self, prob_str):
        # 将 "OneStarCard,5789|TwoStarCard,2995" 这样的字符串解析为 { 分类名称: 权重数值 } 字典
        weights = {}
        for item in prob_str.split('|'):
            if ',' in item:
                k, v = item.split(',')
                weights[k.strip()] = float(v.strip())
        return weights

    def choose_category(self, categories_weights):
        # 通用的带权重随机选择器
        total = sum(categories_weights.values())
        r = random.uniform(0, total)
        for cat, w in categories_weights.items():
            r -= w
            if r <= 0: return cat
        return list(categories_weights.keys())[-1]

    def draw_card_by_category(self, cat):
        all_for_cat = self.cards_by_category.get(cat, [])
        if not all_for_cat:
            return None
            
        # 根据已解锁的 Set 进行过滤筛选
        unlocked_sets = self.get_unlocked_sets()
        eligible = [c for c in all_for_cat if int(c['cardset_from']) in unlocked_sets]
        if not eligible:
            # 兼容逻辑：如果要抽的这张高星卡在所有已解锁的 Set 里都没有，则退回全局卡池，无视解锁逻辑
            eligible = all_for_cat
            
        # 计算每一张候选可抽卡牌的最终权重
        weights = []
        for c in eligible:
            base_w = float(c.get('card_prob', 10))
            cid = int(c['card_id'])
            
            # 开启优化机制 且 该卡牌尚未被收集过，才会重新计算动态干预权重
            if self.enable_weight_control and cid not in self.collected_cards:
                sid = int(c['cardset_from'])
                expected = self.get_expected_cards(sid)
                actual = self.get_set_collected_count(sid)
                delta = expected - actual
                star = int(c['star'])
                is_gold = (int(c.get('card_type', 1)) == 2)
                mult = self.get_multiplier(delta, star, is_gold)
            else:
                mult = 1.0
                
            weights.append(base_w * mult)
            
        # 根据计算好的最终权重，进行带权重随机抽取具体卡牌
        total = sum(weights)
        if total == 0: return random.choice(eligible)
        r = random.uniform(0, total)
        for idx, w in enumerate(weights):
            r -= w
            if r <= 0: return eligible[idx]
        return eligible[-1]

    def open_pack(self, case_id):
        self.stats_packs_opened += 1
        case_info = self.cases_map[case_id]
        
        # 增加卡包开箱带来的基础分值
        if case_id in self.score_map:
            self.player_score += self.score_map[case_id]
            
        # 解析抽取的卡片总数量设定
        # 例如："1,100" (抽1张，100%权重) 或 "4,25|5,50|6,25" (概率抽多张)
        cnt_opts = self.parse_probability_string(case_info['card_count'])
        cnt_to_draw = int(self.choose_category(cnt_opts))
        
        # 读取各类颜色卡的比例
        cat_weights = self.parse_probability_string(case_info['card_type'])
        # 根据更新的机制：保底卡池的权重直接由 min_guarantee_prob 读取
        guarantee_weights = self.parse_probability_string(case_info.get('min_guarantee_prob', ''))
        # 兼容兜底：如果没配，退回老规则
        if not guarantee_weights and 'min_guarantee' in case_info:
            guarantees = [x.strip() for x in case_info['min_guarantee'].split(',')]
            guarantee_weights = {g: cat_weights.get(g, 0) for g in guarantees if g in cat_weights}
        
        drawn = []
        for i in range(cnt_to_draw):
            # 第1张卡必定从保底卡池里抽，其余的卡从普通库里抽
            if i == 0 and sum(guarantee_weights.values()) > 0:
                cat = self.choose_category(guarantee_weights)
            else:
                cat = self.choose_category(cat_weights)
                
            card = self.draw_card_by_category(cat)
            if card:
                cid = int(card['card_id'])
                if cid in self.collected_cards:
                    self.stats_duplicates += 1
                else:
                    self.collected_cards.add(cid)
                self.stats_cards_drawn += 1
                drawn.append(card)
                
        return drawn

    def print_album_state(self, drawn_cards=None, case_id=None):
        if drawn_cards:
            drawn_names = [f"★{c['star']} {c.get('card_name', 'Unknown')}" for c in drawn_cards]
            print(f"\n[开卡包] 您开了 1 个卡包(ID: {case_id})! 抽得: {', '.join(drawn_names)}")
        
        print(f"[数据] 当前分值: {self.player_score:.2f} | 总收集: {len(self.collected_cards)}/108 | 重复卡: {self.stats_duplicates}")
        
        # 一行列表显示每个 Set 的收集张数
        counts = [str(self.get_set_collected_count(sid)) for sid in range(1, 13)]
        print(f"[各Set进度] 张数(1-12): [{', '.join(counts)}]")
        print("-" * 50)

    def print_stats(self):
        print("===== 模拟最终统计 =====")
        print(f"开启卡包总数: {self.stats_packs_opened}")
        print(f"抽出卡牌总数: {self.stats_cards_drawn}")
        print(f"抽出重复卡数: {self.stats_duplicates}")
        print(f"不重复卡片收集: {len(self.collected_cards)} / 108")
        print(f"最终玩家分值: {self.player_score:.2f}")
        print("=========================")

if __name__ == '__main__':
    data_dir = r"c:\Users\TU\Desktop\dzl_tuyoo_project\MG_project\album"
    
    print("\n" + "="*50)
    print(">>> 测试优化调控逻辑开启时的开包历程 (前 20 包展示)")
    print("="*50)
    sim_detail = AlbumSimulator(data_dir, enable_dynamic_unlock=True, enable_weight_control=False)
    for i in range(20): 
        drawn_cards = sim_detail.open_pack(3) # 试抽 ID 为 5 的红色卡包
        sim_detail.print_album_state(drawn_cards, case_id=5)
        
    sim_detail.print_stats()
