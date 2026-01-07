"""
交互式输入处理模块
从 config.yaml 读取配置并生成动态菜单
"""
import yaml
import sys
from pathlib import Path

# 添加当前目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.scraper.playstore_scraper import PlayStoreScraper


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


def display_games_menu(games, extra_options=None, search_first=False):
    """显示游戏选择菜单
    
    Args:
        games: 游戏列表
        extra_options: 额外的选项列表，格式为 [(编号, 名称), ...]
        search_first: 如果为True，将搜索选项显示在第一位
    
    Returns:
        选择的游戏名称或 None
    """
    print("=" * 40)
    print("可用游戏列表:")
    print("=" * 40)
    
    # 分离搜索选项和其他额外选项
    search_option = None
    other_options = []
    if extra_options:
        for num, name in extra_options:
            if "搜索" in name or "查找" in name:
                search_option = (num, name)
            else:
                other_options.append((num, name))
    
    # 如果 search_first 为 True，先显示搜索选项
    if search_first and search_option:
        print(f"  {1}. {search_option[1]}")
        option_offset = 1
    else:
        option_offset = 0
    
    # 显示游戏选项（编号从 1+option_offset 开始）
    for idx, game in enumerate(games, 1 + option_offset):
        print(f"  {idx}. {game['name']}")
    
    # 显示其他额外选项（如果不是搜索选项且 search_first 为 False）
    if not search_first:
        if search_option:
            print(f"  {search_option[0]}. {search_option[1]}")
        for num, name in other_options:
            print(f"  {num}. {name}")
    
    print("=" * 40)
    print()
    
    # 计算最大选择数
    max_choice = len(games) + (len(extra_options) if extra_options else 0)
    choice = input(f"请选择 (1-{max_choice}): ").strip()
    
    try:
        choice_num = int(choice)
        
        # 如果搜索选项在第一位
        if search_first and search_option and choice_num == 1:
            return search_option[1]
        
        # 处理游戏选项
        game_start = 1 + (1 if search_first and search_option else 0)
        if game_start <= choice_num <= game_start + len(games) - 1:
            game_idx = choice_num - game_start
            return games[game_idx]['name']
        
        # 处理额外选项
        if extra_options:
            for num, name in extra_options:
                if choice_num == num:
                    return name
                    
        print(f"错误: 无效的选择，请输入 1-{max_choice} 之间的数字")
    except ValueError:
        print(f"错误: 请输入有效的数字 (1-{max_choice})")
    
    return None


def interactive_scrape_input():
    """交互式采集输入（默认使用搜索）"""
    config = load_config()
    games = get_games_list(config)
    
    if not games:
        print("错误: 配置文件中没有游戏列表！")
        sys.exit(1)
    
    # 默认直接使用搜索功能
    print("=" * 60)
    print("评论采集与筛选工具")
    print("=" * 60)
    print()
    print("提示: 默认使用搜索功能，如需从配置文件选择游戏，请输入 'c'")
    print()
    
    # 询问用户选择模式
    mode_choice = input("请选择模式 (直接按Enter使用搜索，或输入 'c' 从配置文件选择): ").strip().lower()
    
    if mode_choice == 'c':
        # 从配置文件选择游戏
        extra_options = [
            (1, "搜索游戏ID（通过游戏名查找）")
        ]
        game_name = display_games_menu(games, extra_options=extra_options, search_first=True)
        
        # 如果选择了搜索选项
        if game_name == "搜索游戏ID（通过游戏名查找）":
            game_name = search_and_select_game()
            if not game_name:
                print("错误: 未选择游戏或搜索失败")
                sys.exit(1)
        elif not game_name:
            print("错误: 未选择游戏或选择无效")
            sys.exit(1)
    else:
        # 默认直接使用搜索
        game_name = search_and_select_game()
        if not game_name:
            print("错误: 未选择游戏或搜索失败")
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


def search_and_select_game():
    """搜索游戏并选择"""
    print()
    print("=" * 60)
    print("搜索Google Play Store游戏")
    print("=" * 60)
    print()
    
    query = input("请输入游戏名称进行搜索: ").strip()
    
    if not query:
        print("错误: 搜索关键词不能为空")
        return None
    
    print()
    print("正在搜索，请稍候...")
    print()
    
    try:
        # 创建采集器实例
        scraper = PlayStoreScraper(delay=1.0, retry_times=1)
        
        # 搜索应用，获取更多结果以防过滤掉无效项
        results = scraper.search_apps(query, num=10)
        
        if not results:
            print("未找到匹配的游戏，请尝试其他关键词")
            return None
        
        # 只取前5个有效结果
        results = results[:5]
        
        # 显示搜索结果
        print("=" * 60)
        print(f"找到 {len(results)} 个匹配结果:")
        print("=" * 60)
        print()
        
        for result in results:
            print(f"  {result['index']}. {result['title']}")
            print(f"     开发者: {result['developer']}")
            print(f"     应用ID: {result['appId']}")
            print(f"     评分: {result['score']} ⭐")
            print(f"     安装量: {result['installs']}")
            print()
        
        print("=" * 60)
        print()
        
        # 让用户选择
        choice = input(f"请选择游戏 (1-{len(results)}, 或按 Enter 取消): ").strip()
        
        if not choice:
            print("已取消选择")
            return None
        
        try:
            choice_num = int(choice)
            if 1 <= choice_num <= len(results):
                selected = results[choice_num - 1]
                print()
                print(f"✓ 已选择: {selected['title']}")
                print(f"  应用ID: {selected['appId']}")
                print()
                
                # 检查是否已存在于配置中
                config = load_config()
                games = get_games_list(config)
                exists = False
                for game in games:
                    if game.get('name') == selected['title'] or game.get('playstore_id') == selected['appId']:
                        exists = True
                        print(f"✓ 此游戏已存在于配置文件中")
                        break
                
                # 如果不存在，询问是否要添加到配置文件
                if not exists:
                    add_to_config = input("是否要将此游戏添加到配置文件? (y/n, 默认y): ").strip().lower()
                    if add_to_config != 'n':
                        add_game_to_config(selected['title'], selected['appId'])
                    else:
                        print("注意: 游戏未添加到配置文件，后续采集可能无法正常工作")
                
                return selected['title']
            else:
                print(f"错误: 无效的选择，请输入 1-{len(results)} 之间的数字")
                return None
        except ValueError:
            print("错误: 请输入有效的数字")
            return None
            
    except Exception as e:
        print(f"搜索时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def add_game_to_config(game_name: str, app_id: str):
    """将游戏添加到配置文件"""
    try:
        config_path = Path("config.yaml")
        if not config_path.exists():
            print(f"警告: 配置文件 {config_path} 不存在，无法添加")
            return
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # 检查是否已存在
        games = config.get('games', [])
        for game in games:
            if game.get('name') == game_name or game.get('playstore_id') == app_id:
                print(f"游戏 '{game_name}' 或应用ID '{app_id}' 已存在于配置中")
                return
        
        # 添加新游戏
        new_game = {
            'name': game_name,
            'playstore_id': app_id,
            'platforms': ['android']
        }
        games.append(new_game)
        config['games'] = games
        
        # 保存配置文件
        with open(config_path, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        
        print(f"✓ 已成功将 '{game_name}' 添加到配置文件")
        
    except Exception as e:
        print(f"添加游戏到配置文件时出错: {str(e)}")


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

