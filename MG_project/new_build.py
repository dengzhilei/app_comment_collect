# -*- coding: utf-8 -*-
"""
岛屿地块价格配置生成器
"""

from __future__ import print_function, division


def parse_segments(segments):
    """解析分段配置"""
    if not segments:
        return []
    if isinstance(segments[0], (int, float)):
        result = []
        for i in range(0, len(segments), 2):
            result.append((int(segments[i]), float(segments[i + 1])))
        return result
    return segments


def generate_island_weights(segments, base_weight=100):
    """生成岛屿每个地块的权重"""
    segments = parse_segments(segments)
    weights = []
    current_weight = float(base_weight)
    
    for seg_index, (count, multiplier) in enumerate(segments):
        start_weight = current_weight
        end_weight = start_weight * multiplier
        
        if seg_index == 0:
            if count <= 1:
                segment_weights = [end_weight]
            else:
                ratio = end_weight / start_weight
                segment_weights = [start_weight * (ratio ** (i / (count - 1))) for i in range(count)]
        else:
            if count <= 1:
                segment_weights = [end_weight]
            else:
                ratio = end_weight / start_weight
                segment_weights = [start_weight * (ratio ** (i / count)) for i in range(1, count + 1)]
        
        weights.extend(segment_weights)
        current_weight = end_weight
    
    return [int(round(w)) for w in weights]


def calculate_prices(weights, total_cost):
    """根据权重和总花费计算每个地块的实际价格"""
    total_weight = sum(weights)
    prices = [int(round(w / total_weight * total_cost)) for w in weights]
    diff = total_cost - sum(prices)
    if diff != 0:
        prices[-1] += diff
    return prices


def format_list(lst):
    """格式化列表输出（普通格式）"""
    return "[" + ", ".join(str(x) for x in lst) + "]"


def format_indexed(lst):
    """格式化列表输出（带序号格式）: 1,100|2,110|3,120|..."""
    return "|".join("{0},{1}".format(i + 1, x) for i, x in enumerate(lst))


def process_all_islands(segments_list, total_costs, base_weight=100):
    """处理所有岛屿并输出结果"""
    all_weights = []
    all_prices = []
    
    for i in range(len(segments_list)):
        weights = generate_island_weights(segments_list[i], base_weight)
        prices = calculate_prices(weights, total_costs[i])
        all_weights.append(weights)
        all_prices.append(prices)
    
    # 输出所有权重
    print("\n" + "=" * 60)
    print("各岛屿权重列表")
    print("=" * 60)
    for i, weights in enumerate(all_weights):
        # print("岛屿{0} ({1}个):".format(i + 1, len(weights)))
        print(format_indexed(weights))
    
    # 输出所有价格
    print("\n" + "=" * 60)
    print("各岛屿价格列表")
    print("=" * 60)
    for i, prices in enumerate(all_prices):
        print("岛屿{0} ({1:,}):".format(i + 1, sum(prices)))
        print(format_list(prices))
        print()
    
    # 汇总
    print("\n" + "=" * 60)
    total_plots = sum(len(w) for w in all_weights)
    total_price = sum(sum(p) for p in all_prices)
    print("总计: {0} 个地块, 总价: {1:,}".format(total_plots, total_price))
    
    return all_weights, all_prices


# ================== 岛屿配置 ==================
if __name__ == "__main__":
    
    BASE_WEIGHT = 100
    
    # 分段配置: [地块数1, 倍率1, 地块数2, 倍率2, 地块数3, 倍率3]
    SEGMENTS = [
        [5,5,22,2,5,2],
        [15,40,62,15,7,2.5],
        [12,30,63,12,7,2.5],
        [10,27,113,10,7,2.5],
        [10,30,97,9,7,2.5],
        [10,35,107,8,7,2.5],
        [10,40,125,8,7,2.5],
        [10,45,92,8,7,2.5],
    ]
    
    # 总花费
    TOTAL_COSTS = [50000, 3200000, 9600000, 28512000, 59875200, 114633792, 177914880, 252972720]
    
    # 处理所有岛屿
    all_weights, all_prices = process_all_islands(SEGMENTS, TOTAL_COSTS, BASE_WEIGHT)
