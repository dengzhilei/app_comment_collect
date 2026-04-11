import csv
import random
import os
import bisect
import multiprocessing

def parse_csv(filepath):
    """
    解析项目配置的 CSV 表格，跳过前四行（框架元数据行）。
    输入:
        filepath (str): CSV 文件的绝对或相对路径。
    输出:
        list[dict]: 包含表格数据的列表，每一行都被解析为一个字典，键为表头内容。
    """
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
        """
        初始化模拟器类并加载所有配置表。
        输入:
            data_dir (str): 配置文件的根目录路径。
            enable_dynamic_unlock (bool): 是否开启根据收集进度动态解锁 Set 的卡池控制。
            enable_weight_control (bool): 是否开启根据差异值干预概率的动态权重倍率控制。
        """
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
        
        # 记录每个 Set 收集到 1~9 张时的游戏分值状态
        # 结构: {set_id: {card_count: score_when_reached}}
        self.set_progress_score = {sid: {} for sid in range(1, 13)}
        
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
        """
        根据当前玩家的游戏分值（player_score），计算对应 Set 的期待收集张数（带小数）。
        输入:
            set_id (int): 目标卡册 Set 的 ID (1-12)。
        输出:
            float: 该玩家分值区间下线性插值计算得出的预期收集卡牌张数量。
        """
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
        """
        根据卡牌当前的收集偏差值和它的星级属性，获取对应的权重干预倍率。
        输入:
            c_delta (float): 当前卡牌期望张数与实际收集张数的差值 (期望张数 - 实际张数)。
            star (int): 卡牌星级 (1-6)。
            is_gold (bool): 是否为金卡类型，用于决定获取普通列表还是金卡专属列表数据。
        输出:
            float: 该张卡牌在随机抽取时权重应该乘上的干预倍率。
        """
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
        """
        执行完整的一次卡包开启以及相应的抽卡过程：含读取数量、保底干预及主随机抽取。
        输入:
            case_id (int): 在 cardcase.csv 中定义的被抽取的卡包 ID（如 5 为红卡包）。
        输出:
            list[dict]: 本次抽取到的所有独立卡牌信息数据实体的列表。
        """
        self.stats_packs_opened += 1
        case_info = self.cases_map[case_id]
        
        # 记录开包前的各个 set 进度
        old_set_counts = {sid: self.get_set_collected_count(sid) for sid in range(1, 13)}
        
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
                
        # 记录开包后的进度，更新跨越的分值节点
        for sid in range(1, 13):
            new_count = self.get_set_collected_count(sid)
            old_count = old_set_counts[sid]
            if new_count > old_count:
                for target_cnt in range(old_count + 1, min(new_count + 1, 10)):
                    if target_cnt not in self.set_progress_score[sid]:
                        self.set_progress_score[sid][target_cnt] = self.player_score
                        
        return drawn

    def print_album_state(self, drawn_cards=None, case_id=None, is_batch=False, batch_count=0, batch_cases=None, batch_drawn_cards=None, batch_new=0, batch_dup=0):
        if is_batch:
            from collections import Counter
            case_counts = Counter(batch_cases or [])
            case_summary = []
            for cid, count in case_counts.items():
                c_name = self.cases_map[cid].get('#color', f'ID:{cid}') if cid in self.cases_map else f'ID:{cid}'
                case_summary.append(f"{c_name}x{count}")
            
            star_counts = Counter(int(c['star']) for c in (batch_drawn_cards or []))
            star_summary = []
            for star in sorted(star_counts.keys()):
                star_summary.append(f"★{star}x{star_counts[star]}")
                
            print(f"\n[批量开卡包] 开启 {batch_count} 包 ({' + '.join(case_summary)}) | 本次抽到: {batch_new} 张新卡, {batch_dup} 张重复卡 | 分布: {', '.join(star_summary) if star_summary else '无'}")
        elif drawn_cards:
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

def run_simulation(data_dir, pack_sequence, print_interval=0, enable_dynamic_unlock=True, enable_weight_control=True):
    """
    单次模拟进程包裹函数。按给定的卡包序列连续模拟开启，并在各个生命周期节点收集与打印监控数据。
    输入:
        data_dir (str): 数据表文件夹的根目录。
        pack_sequence (list[int]): 按顺序执行开包操作的卡包 ID 数组 (如 [1,1,2,5]...)。
        print_interval (int): 终端打印过程日志的频率 (单位为卡包数)，0 表示纯静默运行。
        enable_dynamic_unlock (bool): 是否开启根据收集进度动态解锁 Set 的卡池控制。
        enable_weight_control (bool): 是否开启根据差异值干预概率的动态权重倍率控制。
    输出:
        dict: 模拟器生命周期内，各 Set 达到 1~9 张时的累计玩家分值的追溯字典 (self.set_progress_score)。
    """
    sim = AlbumSimulator(data_dir, enable_dynamic_unlock=enable_dynamic_unlock, enable_weight_control=enable_weight_control)
    
    batch_count = 0
    batch_cases = []
    batch_drawn_cards = []
    last_collected = 0
    last_duplicates = 0
    
    if print_interval > 0:
        print("\n" + "="*50)
        print(">>> 测试优化调控逻辑开启时的配置开包历程")
        print(f"设定序列总计: {len(pack_sequence)} 包 | 打印间隔: 每 {print_interval} 包输出一次")
        print("="*50)

    for i, case_id in enumerate(pack_sequence): 
        drawn_cards = sim.open_pack(case_id)
        
        if print_interval > 0:
            batch_count += 1
            batch_cases.append(case_id)
            batch_drawn_cards.extend(drawn_cards)
            
            is_last = (i == len(pack_sequence) - 1)
            if (i + 1) % print_interval == 0 or is_last:
                batch_new_count = len(sim.collected_cards) - last_collected
                batch_dup_count = sim.stats_duplicates - last_duplicates
                
                if print_interval == 1:
                    sim.print_album_state(drawn_cards, case_id=case_id)
                else:
                    sim.print_album_state(is_batch=True, batch_count=batch_count, batch_cases=batch_cases, batch_drawn_cards=batch_drawn_cards, batch_new=batch_new_count, batch_dup=batch_dup_count)
                    
                batch_count = 0
                batch_cases = []
                batch_drawn_cards = []
                last_collected = len(sim.collected_cards)
                last_duplicates = sim.stats_duplicates
            
    if print_interval > 0:
        sim.print_stats()
        
    return sim.set_progress_score, len(sim.collected_cards)

def _simulation_worker(args):
    data_dir, pack_sequence, enable_dynamic_unlock, enable_weight_control = args
    return run_simulation(data_dir, pack_sequence, print_interval=0, enable_dynamic_unlock=enable_dynamic_unlock, enable_weight_control=enable_weight_control)

def run_multiple_simulations(data_dir, pack_sequence, num_runs=100, enable_dynamic_unlock=True, enable_weight_control=True):
    """
    多进程大规模大数收敛测试入口。派发 num_runs 轮同样配置的模拟进程并聚合汇总最终节点均值。
    输入:
        data_dir (str): 数据表文件夹的根目录。
        pack_sequence (list[int]): 子进程每轮完整模拟需要执行的开包定死序列。
        num_runs (int): 并发运行的模拟进程总数与迭代数 (默认 100 轮)。
        enable_dynamic_unlock (bool): 参数穿透，是否动态解锁。
        enable_weight_control (bool): 参数穿透，是否动态调控权重。
    输出:
        无直接结构体返回值，主要负责在终端计算汇总报表并排版输出均值列表。
    """
    print(f"\n[多进程] 开始执行 {num_runs} 次模拟测试，正在分配给 CPU 核心...")
    pool_args = [(data_dir, pack_sequence, enable_dynamic_unlock, enable_weight_control) for _ in range(num_runs)]
    
    with multiprocessing.Pool(processes=multiprocessing.cpu_count()) as pool:
        results = pool.map(_simulation_worker, pool_args)
        
    aggregated = {sid: {cnt: [] for cnt in range(1, 10)} for sid in range(1, 13)}
    final_collected_counts = []
    
    for res, total_collected in results:
        final_collected_counts.append(total_collected)
        for sid, progress in res.items():
            for cnt, score in progress.items():
                aggregated[sid][cnt].append(score)
                
    import math
    from collections import Counter
    
    print("\n" + "="*80)
    print(f">>> {num_runs} 次模拟后，【最终收集不重复卡牌张数】分布 (总卡池 108 张)")
    print("="*80)
    
    mean_cards = sum(final_collected_counts) / len(final_collected_counts)
    variance = sum((x - mean_cards) ** 2 for x in final_collected_counts) / len(final_collected_counts)
    std_dev = math.sqrt(variance)
    
    print(f"统计指标: 均值 = {mean_cards:.2f} 张 | 最小值 = {min(final_collected_counts)} | 最大值 = {max(final_collected_counts)} | 标准差(波动率) = {std_dev:.2f}")
    
    print("\n[具体落点分布]:")
    counts_dist = Counter(final_collected_counts)
    for cnt in sorted(counts_dist.keys()):
        print(f"  {cnt:3d} 张 : {counts_dist[cnt]:4d} 次 ({counts_dist[cnt]/num_runs*100:5.1f}%)")

    print("\n" + "="*80)
    print(f">>> {num_runs} 次模拟后，各卡册收集到 1-9 张时的【开包累计分值】均值汇总")
    print("="*80)
    
    header = "Set  ID | " + " | ".join([f" {i}张 " for i in range(1, 10)])
    print(header)
    print("-" * len(header))
    
    for sid in range(1, 13):
        row_str = f"Set {sid:2d} |"
        for cnt in range(1, 10):
            scores = aggregated[sid][cnt]
            if scores:
                avg_score = sum(scores) / len(scores)
                row_str += f" {avg_score:6.1f} |"
            else:
                row_str += "    --  |"
        print(row_str)


if __name__ == '__main__':
    # 为了多进程在 Windows 上安全运行，需要这行声明（虽然 __main__ 块通常已经没问题）
    multiprocessing.freeze_support()
    
    data_dir = r"c:\Users\TU\Desktop\dzl_tuyoo_project\MG_project\album"
    
    # ==========================
    # === 自定义模拟测试配置 ===
    # ==========================
    
    # 测试使用的卡包序列
    pack_sequence = ([1] * 4 + [2] * 3 + [3] * 2 + [4]*1) * 10
    pack_sequence = ([1] * 12 + [2] * 9 + [3] * 5 + [4]*3 + [5]*1) * 5
    
    # 是否开启调控机制控制
    use_dynamic_unlock = True
    use_weight_control = False
    
    # 【模式 1】：单次模拟，带详细打印
    # run_simulation(data_dir, pack_sequence, print_interval=10, 
    #                enable_dynamic_unlock=use_dynamic_unlock, 
    #                enable_weight_control=use_weight_control)
    
    # 【模式 2】：多进程跑几百次，获取均值汇总分布
    run_multiple_simulations(data_dir, pack_sequence, num_runs=1000, 
                             enable_dynamic_unlock=use_dynamic_unlock, 
                             enable_weight_control=use_weight_control)
