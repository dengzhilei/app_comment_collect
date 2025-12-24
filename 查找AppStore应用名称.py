"""
帮助查找App Store上的确切应用名称
"""
import logging
import yaml
import webbrowser
from pathlib import Path

try:
    from app_store_scraper import AppStore
except ImportError:
    print("错误: app-store-scraper 未安装")
    print("请运行: pip install app-store-scraper")
    exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def find_app_name_by_id(app_id: str, country: str = "us"):
    """
    通过App Store ID查找应用名称
    
    方法1: 尝试使用app-store-scraper获取
    方法2: 提供App Store网页链接，让用户手动查看
    """
    print("="*60)
    print(f"查找App Store应用名称")
    print(f"App ID: {app_id}")
    print(f"国家: {country}")
    print("="*60)
    print()
    
    # 方法1: 尝试不同的应用名称
    test_names = [
        "TopTycoon",
        "Top Tycoon",
        "Monopoly Dream Idle King",
        "Monopoly Dream",
        "Idle King",
    ]
    
    print("方法1: 尝试常见应用名称...")
    for test_name in test_names:
        try:
            print(f"  尝试: '{test_name}'...", end=" ")
            app = AppStore(country=country, app_name=test_name, app_id=app_id)
            app.review(how_many=1)  # 只获取1条评论来验证
            
            if app.reviews or hasattr(app, 'app_name'):
                print(f"✓ 成功！")
                print(f"  建议使用的应用名称: '{test_name}'")
                return test_name
            else:
                print("✗ 未找到")
        except Exception as e:
            print(f"✗ 失败: {str(e)[:50]}")
    
    print()
    print("方法2: 请手动查看App Store网页")
    print(f"  打开以下链接查看应用的确切名称：")
    print()
    
    # 生成App Store链接
    app_store_url = f"https://apps.apple.com/us/app/id{app_id}"
    print(f"  {app_store_url}")
    print()
    
    # 询问是否打开浏览器
    try:
        response = input("是否在浏览器中打开此链接？(y/n): ").strip().lower()
        if response == 'y':
            webbrowser.open(app_store_url)
            print("  已在浏览器中打开")
    except:
        pass
    
    print()
    print("="*60)
    print("使用说明：")
    print("1. 在App Store页面查看应用的确切名称")
    print("2. 将应用名称填入 config.yaml 中的 appstore_name 字段")
    print("3. 如果 appstore_name 为空，系统会使用 name 字段")
    print("="*60)
    
    return None


def update_config_with_app_name(game_name: str, app_name: str):
    """更新config.yaml中的应用名称"""
    config_path = "config.yaml"
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    # 查找游戏配置
    for game in config['games']:
        if game['name'] == game_name:
            game['appstore_name'] = app_name
            break
    
    # 保存配置
    with open(config_path, 'w', encoding='utf-8') as f:
        yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    
    print(f"\n✓ 已更新 config.yaml: {game_name}.appstore_name = '{app_name}'")


if __name__ == "__main__":
    # 加载配置
    config_path = "config.yaml"
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    # 查找TopTycoon配置
    game_config = None
    for game in config['games']:
        if game['name'] == 'TopTycoon':
            game_config = game
            break
    
    if not game_config:
        print("未找到TopTycoon配置")
        exit(1)
    
    app_id = game_config.get('appstore_id', '')
    game_name = game_config.get('name', 'TopTycoon')
    
    if not app_id:
        print("App Store ID未配置")
        exit(1)
    
    # 查找应用名称
    found_name = find_app_name_by_id(app_id, country='us')
    
    if found_name:
        print()
        response = input(f"是否将 '{found_name}' 保存到 config.yaml？(y/n): ").strip().lower()
        if response == 'y':
            update_config_with_app_name(game_name, found_name)

