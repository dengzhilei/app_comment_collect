"""
交互式输入处理模块
从 config.yaml 读取配置并生成动态菜单
"""
import yaml
import sys
from pathlib import Path


def load_config():
    """加载配置文件"""
    config_path = Path("config.yaml")
    if not config_path.exists():
        print(f"错误: 配置文件 {config_path} 不存在！")
        sys.exit(1)
    
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def get_games_list(config):
    """获取游戏列表"""
    return config.get('games', [])


def display_games_menu(games, extra_options=None):
    """显示游戏选择菜单
    
    Args:
        games: 游戏列表
        extra_options: 额外的选项列表，格式为 [(编号, 名称), ...]
    
    Returns:
        选择的游戏名称或 None
    """
    print("=" * 40)
    print("可用游戏列表:")
    print("=" * 40)
    
    # 显示游戏选项
    for idx, game in enumerate(games, 1):
        print(f"  {idx}. {game['name']}")
    
    # 显示额外选项
    start_num = len(games) + 1
    if extra_options:
        for num, name in extra_options:
            print(f"  {num}. {name}")
    
    print("=" * 40)
    print()
    
    # 获取用户选择
    max_choice = len(games) + (len(extra_options) if extra_options else 0)
    choice = input(f"请选择 (1-{max_choice}): ").strip()
    
    try:
        choice_num = int(choice)
        if 1 <= choice_num <= len(games):
            return games[choice_num - 1]['name']
        elif extra_options:
            # 处理额外选项
            for num, name in extra_options:
                if choice_num == num:
                    return name
        else:
            print(f"错误: 无效的选择，请输入 1-{len(games)} 之间的数字")
    except ValueError:
        print(f"错误: 请输入有效的数字 (1-{len(games) + (len(extra_options) if extra_options else 0)})")
    
    return None


def interactive_scrape_input():
    """交互式采集输入"""
    config = load_config()
    games = get_games_list(config)
    
    if not games:
        print("错误: 配置文件中没有游戏列表！")
        sys.exit(1)
    
    # 只显示配置中的游戏，不提供手动输入选项
    game_name = display_games_menu(games, extra_options=None)
    
    if not game_name:
        print("错误: 未选择游戏或选择无效")
        sys.exit(1)
    
    print()
    print(f"已选择游戏: {game_name}")
    print()
    
    # 询问时间范围
    print("=" * 40)
    print("时间范围设置")
    print("=" * 40)
    print("  1. 最近一年 (默认)")
    print("  2. 自定义时间范围")
    print("=" * 40)
    print()
    
    time_choice = input("请选择时间范围 (1-2): ").strip()
    
    if time_choice == "2":
        print()
        start_date = input("请输入开始日期 (格式: YYYY-MM-DD, 例如: 2025-09-01): ").strip()
        end_date = input("请输入结束日期 (格式: YYYY-MM-DD, 例如: 2025-12-31): ").strip()
        
        if not start_date or not end_date:
            print("错误: 日期不能为空")
            sys.exit(1)
        
        return game_name, start_date, end_date
    else:
        return game_name, None, None


def interactive_filter_input():
    """交互式筛选输入"""
    config = load_config()
    games = get_games_list(config)
    
    if not games:
        print("错误: 配置文件中没有游戏列表！")
        sys.exit(1)
    
    # 额外选项：只保留自动检测选项
    extra_options = [
        (len(games) + 1, "自动使用最新的数据文件")
    ]
    
    # 显示菜单并获取选择
    game_name = display_games_menu(games, extra_options)
    
    if game_name == "自动使用最新的数据文件":
        game_name = None
    elif not game_name:
        print("错误: 未选择游戏或选择无效")
        sys.exit(1)
    
    return game_name


if __name__ == "__main__":
    # 测试模式
    if len(sys.argv) > 1:
        mode = sys.argv[1]
        if mode == "scrape":
            result = interactive_scrape_input()
            if result[1]:
                print(f"游戏: {result[0]}, 开始日期: {result[1]}, 结束日期: {result[2]}")
            else:
                print(f"游戏: {result[0]}, 使用默认时间范围")
        elif mode == "filter":
            result = interactive_filter_input()
            print(f"游戏: {result if result else '自动检测'}")

