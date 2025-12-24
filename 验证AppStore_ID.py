"""
验证App Store ID是否正确
"""
import logging
import yaml
from pathlib import Path

try:
    from app_store_scraper import AppStore
except ImportError:
    print("错误: app-store-scraper 未安装")
    print("请运行: pip install app-store-scraper")
    exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def verify_app_id():
    """验证App Store ID"""
    
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
        return
    
    app_id = game_config.get('appstore_id', '')
    app_name = game_config.get('name', 'TopTycoon')
    
    print("="*60)
    print(f"验证App Store ID: {app_id}")
    print(f"应用名称: {app_name}")
    print("="*60)
    print()
    
    # 尝试不同国家
    countries = ['us', 'cn', 'gb']
    
    for country in countries:
        print(f"尝试国家: {country}")
        try:
            app = AppStore(country=country, app_name=app_name, app_id=app_id)
            print(f"  ✓ AppStore对象创建成功")
            
            # 尝试获取评论（少量）
            print(f"  尝试获取评论...")
            app.review(how_many=10)
            
            if app.reviews:
                print(f"  ✓ 成功获取 {len(app.reviews)} 条评论")
                print(f"  第一条评论示例:")
                if app.reviews:
                    first_review = app.reviews[0]
                    print(f"    评分: {first_review.get('rating', 'N/A')}")
                    print(f"    标题: {first_review.get('title', 'N/A')}")
                    print(f"    内容: {first_review.get('review', 'N/A')[:50]}...")
                print()
                print(f"✓ 验证成功！可以使用国家代码: {country}")
                return country
            else:
                print(f"  ⚠ 未获取到评论")
        except Exception as e:
            print(f"  ✗ 失败: {str(e)}")
        print()
    
    print("="*60)
    print("所有国家都未成功，可能的原因：")
    print("  1. App Store ID不正确")
    print("  2. 应用名称不匹配")
    print("  3. 该应用在某些国家不可用")
    print("  4. 网络或反爬虫限制")
    print("="*60)


if __name__ == "__main__":
    verify_app_id()

