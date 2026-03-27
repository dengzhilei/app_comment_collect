# -*- coding: utf-8 -*-
"""
请根据下面的配置，模拟各档萝卜 各拔若干次，所需要平均拔的次数
"""

import random

pull_carrtor_config = [
    # 总共12档萝卜，分别代表每一档萝卜的：
    # 总长度、1档区间、2档区间、常规力气拔一次上升高度、大力气拔一次上升高度、超大力气拔一次上升高度
    # 1档区间：萝卜被拔出离地面长度超过该值时，使用2档概率，没超过该值，使用1档概率
    # 2档区间：萝卜被拔出离地面长度超过该值时，使用3档概率，没超过该值，使用2档概率
[10,10,99,4,8,10],
[15,10,99,4,8,15],
[20,12,16,4,8,20],
[25,15,20,4,8,25],
[10,10,99,3,6,10],
[15,10,99,3,6,15],
[20,12,16,3,6,20],
[25,15,20,3,6,25],
[10,10,99,2,4,10],
[15,10,99,2,4,15],
[20,12,16,2,4,20],
[25,15,20,2,4,25],
]

pull_weight_config = [
    # 1、2、3档 状态，对应使用各档力气的 概率
    # 常规、大力气、超大力气、拔了不动
[0.8,0,0.01,0.3],
[0.54,0,0,0.5],
[0.3,0,0,0.7],
]


def get_weight_level(current_height, threshold1, threshold2):
    """
    根据当前高度判断使用哪档概率
    current_height: 当前已拔出的高度
    threshold1: 1档区间阈值
    threshold2: 2档区间阈值
    """
    if current_height < threshold1:
        return 0  # 使用1档概率
    elif current_height < threshold2:
        return 1  # 使用2档概率
    else:
        return 2  # 使用3档概率


def simulate_single_pull(carrot_config):
    """
    模拟拔一个萝卜，返回拔出所需的次数
    carrot_config: [总长度, 1档区间, 2档区间, 常规上升, 大力上升, 超大力上升]
    """
    total_length, threshold1, threshold2, normal_rise, big_rise, super_rise = carrot_config
    rise_values = [normal_rise, big_rise, super_rise, 0]  # 对应4种力气的上升值
    
    current_height = 0  # 当前已拔出的高度
    pull_count = 0      # 拔的次数
    
    while current_height < total_length:
        pull_count += 1
        
        # 根据当前高度确定使用哪档概率
        weight_level = get_weight_level(current_height, threshold1, threshold2)
        weights = pull_weight_config[weight_level]
        
        # 根据概率随机选择力气类型（0:常规, 1:大力, 2:超大力, 3:不动）
        force_type = random.choices([0, 1, 2, 3], weights=weights)[0]
        
        # 上升相应高度
        current_height += rise_values[force_type]
    
    return pull_count


def simulate_carrot(carrot_index, carrot_config, num_simulations=10000):
    """
    模拟某档萝卜多次，计算平均拔出次数
    """
    total_pulls = 0
    for _ in range(num_simulations):
        total_pulls += simulate_single_pull(carrot_config)
    
    avg_pulls = total_pulls / num_simulations
    return avg_pulls


def main():
    """主函数：模拟所有档位萝卜"""
    num_simulations = 10000  # 每档萝卜模拟次数
    
    print("=" * 70)
    print("萝卜拔出模拟结果（模拟 {} 次）".format(num_simulations))
    print("=" * 70)
    print("{:>6} | {:>8} | {:>8} | {:>8} | {:>12} | {:>12}".format(
        "档位", "总长度", "1档区间", "2档区间", "平均拔次数", "配置(常/大/超)"))
    print("-" * 70)
    
    for i, config in enumerate(pull_carrtor_config):
        total_length, th1, th2, normal, big, super_big = config
        avg_pulls = simulate_carrot(i, config, num_simulations)
        
        print("{:>6} | {:>8} | {:>8} | {:>8} | {:>12.2f} | {:>4}/{:>4}/{:>4}".format(
            i + 1, total_length, th1, th2, avg_pulls, normal, big, super_big))
    
    print("=" * 70)
    
    # 按组分类统计（每4档为一组，共3组）
    print("\n按力气配置分组统计：")
    print("-" * 50)
    groups = [
        ("常规5/大力10", pull_carrtor_config[0:4]),
        ("常规4/大力8", pull_carrtor_config[4:8]),
        ("常规3/大力6", pull_carrtor_config[8:12]),
    ]
    
    for group_name, group_configs in groups:
        print("\n【{}】".format(group_name))
        for j, config in enumerate(group_configs):
            avg = simulate_carrot(j, config, num_simulations)
            print("  总长度{:>3}: 平均 {:.2f} 次".format(config[0], avg))


if __name__ == "__main__":
    main()
