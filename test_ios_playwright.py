"""
使用Playwright测试iOS评论采集
"""
import logging
import json
import yaml
from pathlib import Path
from datetime import datetime

from src.scraper.appstore_scraper_playwright import AppStoreScraperPlaywright

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_playwright_scraper():
    """测试Playwright采集器"""
    
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
        logger.error("未找到TopTycoon配置")
        return False
    
    game_name = game_config['name']
    app_id = game_config.get('appstore_id', '')
    appstore_name = game_config.get('appstore_name', '') or game_name
    
    if not app_id:
        logger.error("TopTycoon的App Store ID未配置！")
        return False
    
    logger.info("="*60)
    logger.info(f"开始测试Playwright采集: {game_name} (iOS)")
    logger.info(f"App Store ID: {app_id}")
    logger.info(f"应用名称: {appstore_name}")
    logger.info("="*60)
    logger.info("")
    logger.info("注意：Playwright会打开浏览器窗口（如果headless=False）")
    logger.info("这是正常的，用于模拟真实用户访问")
    logger.info("")
    
    try:
        # 创建采集器（headless=False会显示浏览器，便于调试）
        scraper = AppStoreScraperPlaywright(
            delay=3.0,
            retry_times=3,
            headless=False  # 显示浏览器窗口，可以看到采集过程
        )
        
        # 测试采集（最近30天，最多50条）
        logger.info("开始采集评论...")
        reviews = scraper.get_reviews(
            app_id=app_id,
            app_name=appstore_name,
            country='us',
            days=30,
            max_reviews=50
        )
        
        if reviews:
            logger.info(f"\n✓ 采集成功！共获取 {len(reviews)} 条评论")
            
            # 显示前几条评论示例
            logger.info("\n前3条评论示例:")
            for i, review in enumerate(reviews[:3], 1):
                logger.info(f"\n评论 {i}:")
                logger.info(f"  评分: {review.get('rating', 'N/A')}")
                logger.info(f"  日期: {review.get('date', 'N/A')[:10] if review.get('date') else 'N/A'}")
                logger.info(f"  标题: {review.get('title', 'N/A')}")
                content = review.get('content', '')
                logger.info(f"  内容: {content[:100]}{'...' if len(content) > 100 else ''}")
            
            # 保存测试数据
            output_dir = Path("data/raw")
            output_dir.mkdir(parents=True, exist_ok=True)
            output_file = output_dir / f"{game_name.replace(' ', '_')}_ios_playwright_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
            scraper.save_reviews(reviews, str(output_file))
            logger.info(f"\n✓ 测试数据已保存到: {output_file}")
            
            return True
        else:
            logger.warning("⚠ 未采集到任何评论")
            logger.info("可能的原因：")
            logger.info("  1. App Store页面结构变化")
            logger.info("  2. 该时间段内没有评论")
            logger.info("  3. 需要调整选择器")
            return False
            
    except ImportError as e:
        logger.error(f"❌ 导入错误: {str(e)}")
        logger.error("请先安装依赖:")
        logger.error("  pip install playwright")
        logger.error("  playwright install chromium")
        return False
    except Exception as e:
        logger.error(f"❌ 测试失败: {str(e)}", exc_info=True)
        return False


if __name__ == "__main__":
    success = test_playwright_scraper()
    if success:
        print("\n✓ 测试成功！可以继续使用Playwright方法采集。")
    else:
        print("\n✗ 测试失败，请检查错误信息。")

