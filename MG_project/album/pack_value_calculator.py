import csv
import os

def parse_csv(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        headers = []
        data = []
        for i, row in enumerate(reader):
            if i == 0:
                headers = row
            if i < 4: continue
            if not any(row): continue
            doc = {}
            for j, val in enumerate(row):
                if j < len(headers) and headers[j].strip():
                    doc[headers[j].strip()] = val.strip()
            data.append(doc)
    return data

def parse_probability_string(prob_str):
    weights = {}
    if not prob_str:
        return weights
    for item in prob_str.split('|'):
        if ',' in item:
            k, v = item.split(',')
            try:
                weights[k.strip()] = float(v.strip())
            except ValueError:
                pass
    return weights

# ==========================================
# 在此预设各星级卡片【单张】的分值配置
# 分普通卡(Card) 和 金卡(Gold) 两种，可随时调整
# ==========================================
CARD_SCORES = {
    'OneStarCard': 1.0,
    'TwoStarCard': 1.7,
    'ThreeStarCard': 2.6,
    'FourStarCard': 4.0,
    'FourStarGold': 6.0,    # 金卡可在此单独赋予更高分值
    'FiveStarCard': 6.0,
    'FiveStarGold': 8.0,
    'SixStarCard': 7.0,
    'SixStarGold': 9.0,
}

def expected_value(weights_dict):
    """根据权重字典计算抽取1张卡时的卡牌期望分值"""
    total_weight = sum(weights_dict.values())
    if total_weight == 0: return 0.0
    ev = 0.0
    for cat, w in weights_dict.items():
        prob = w / total_weight
        score = CARD_SCORES.get(cat, 0.0)
        ev += prob * score
    return ev


def calculate_all_packs(data_dir):
    cardcases = parse_csv(os.path.join(data_dir, 'album_config', 'cardcase.csv'))
    
    print("\n" + "="*60)
    print(">>> 各类卡包「期望卡牌分值」计算结果")
    print("="*60)
    print("当前单卡分值设置:")
    for k, v in CARD_SCORES.items():
        print(f"  - {k}: {v} 分")
    print("-" * 60)
    
    for case in cardcases:
        if 'cardcase_id' not in case: continue
        cid = int(case['cardcase_id'])
        cname = case.get('#color', f'ID:{cid}')
        
        # 计算期望抽卡张数 
        # 因为卡包的数量是权重决定的，比如 "4,25|5,50|6,25"
        cnt_opts = parse_probability_string(case.get('card_count', ''))
        total_cnt_w = sum(cnt_opts.values())
        if total_cnt_w == 0: continue
        
        expected_cnt = 0.0
        for cnt_str, w in cnt_opts.items():
            expected_cnt += float(cnt_str) * (w / total_cnt_w)
            
        # 主卡池各种类的权重
        cat_weights = parse_probability_string(case.get('card_type', ''))
        
        # 保底卡池各种类的权重
        guarantee_weights = parse_probability_string(case.get('min_guarantee_prob', ''))
        if not guarantee_weights and 'min_guarantee' in case:
            guarantees = [x.strip() for x in case['min_guarantee'].split(',')]
            guarantee_weights = {g: cat_weights.get(g, 0) for g in guarantees if g in cat_weights}
            
        # 第1张卡（保底卡）的分值期望
        first_card_ev = 0.0
        if sum(guarantee_weights.values()) > 0:
            first_card_ev = expected_value(guarantee_weights)
        else:
            first_card_ev = expected_value(cat_weights)
            
        # 剩下 (期望总张数 - 1) 张卡，全部从普通池算平均期望收益
        rest_cards_ev = 0.0
        if expected_cnt > 1:
            rest_cards_ev = (expected_cnt - 1) * expected_value(cat_weights)
            
        total_ev = first_card_ev + rest_cards_ev
        
        print(f"卡包 ID: {cid:<2} | {cname:　<6}| 期望抽卡数: {expected_cnt:>4.2f} 张 | 期望卡牌总分值: {total_ev:>6.2f} 分")

if __name__ == '__main__':
    data_dir = r"c:\Users\TU\Desktop\dzl_tuyoo_project\MG_project\album"
    calculate_all_packs(data_dir)
