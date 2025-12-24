"""
测试脚本 - 测试TopTycoon iOS数据采集
"""
import logging
import json
import yaml
from pathlib import Path
from datetime import datetime

from src.scraper.appstore_scraper import AppStoreScraper

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def test_appstore_scraper():
    """测试App Store评论采集"""
    
    # 加载配置
    config_path = "config.yaml"
    if not Path(config_path).exists():
        logger.error(f"配置文件 {config_path} 不存在！")
        return False
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    # 查找TopTycoon配置
    game_config = None
    for game in config['games']:
        if game['name'] == 'TopTycoon':
            game_config = game
            break
    
    if not game_config:
        logger.error("未找到TopTycoon配置！")
        return False
    
    game_name = game_config['name']
    app_id = game_config.get('appstore_id', '')
    # 优先使用appstore_name，如果为空则使用name
    appstore_name = game_config.get('appstore_name', '') or game_name
    
    if not app_id:
        logger.error("TopTycoon的App Store ID未配置！")
        logger.info("请在config.yaml中填写appstore_id")
        return False
    
    # 测试配置
    days = 30  # 测试时只采集最近30天
    max_reviews = 50  # 测试时只采集50条
    
    logger.info("="*60)
    logger.info(f"开始测试采集: {game_name} (iOS)")
    logger.info(f"App Store ID: {app_id}")
    logger.info(f"使用应用名称: '{appstore_name}'")
    if game_config.get('appstore_name'):
        logger.info(f"  (来自appstore_name配置)")
    else:
        logger.info(f"  (来自name字段，如需更改请填写appstore_name)")
    logger.info(f"时间范围: 最近 {days} 天")
    logger.info(f"最大评论数: {max_reviews}")
    logger.info("="*60)
    
    try:
        # 创建采集器
        scraper = AppStoreScraper(delay=2.0, retry_times=3)
        
        # 先验证应用信息
        logger.info(f"\n正在验证应用信息...")
        logger.info(f"尝试获取应用详情（这可能需要几秒钟）...")
        try:
            from app_store_scraper import AppStore
            test_app = AppStore(country='us', app_name=appstore_name, app_id=app_id)
            logger.info(f"✓ App Store对象创建成功")
            logger.info(f"  应用ID: {app_id}")
            logger.info(f"  应用名称: {appstore_name}")
            logger.info(f"  国家: 美国 (us)")
        except Exception as e:
            logger.warning(f"⚠ 应用信息验证时出现警告: {str(e)}")
            logger.info("继续尝试采集评论...")
        
        # 采集评论
        logger.info(f"\n开始采集评论...")
        reviews = scraper.get_reviews(
            app_id=app_id,
            app_name=appstore_name,  # 使用配置的应用名称
            country='us',  # 美国区
            days=days,
            max_reviews=max_reviews
        )
        
        if reviews:
            logger.info(f"\n✓ 采集成功！共获取 {len(reviews)} 条评论")
            
            # 显示前几条评论示例
            logger.info("\n前3条评论示例:")
            for i, review in enumerate(reviews[:3], 1):
                logger.info(f"\n评论 {i}:")
                logger.info(f"  评分: {review.get('rating', 'N/A')}")
                logger.info(f"  标题: {review.get('title', 'N/A')}")
                logger.info(f"  日期: {review.get('date', 'N/A')[:10] if review.get('date') else 'N/A'}")
                content = review.get('content', '')
                logger.info(f"  内容: {content[:100]}{'...' if len(content) > 100 else ''}")
            
            # 保存测试数据
            output_dir = Path("data/raw")
            output_dir.mkdir(parents=True, exist_ok=True)
            
            output_file = output_dir / f"{game_name.replace(' ', '_')}_ios_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(reviews, f, ensure_ascii=False, indent=2)
            
            logger.info(f"\n✓ 测试数据已保存到: {output_file}")
            
            # 统计信息
            if reviews:
                ratings = [r.get('rating', 0) for r in reviews if r.get('rating')]
                if ratings:
                    avg_rating = sum(ratings) / len(ratings)
                    logger.info(f"\n统计信息:")
                    logger.info(f"  平均评分: {avg_rating:.2f}")
                    rating_dist = {}
                    for r in set(ratings):
                        rating_dist[int(r)] = ratings.count(r)
                    logger.info(f"  评分分布: {rating_dist}")
            
            logger.info("\n" + "="*60)
            logger.info("测试完成！")
            logger.info("="*60)
            logger.info("\n如果测试成功，可以运行完整采集：")
            logger.info("  双击: 运行TopTycoon_iOS采集.bat")
            logger.info("="*60)
            
            return True
        else:
            logger.warning("⚠ 未采集到任何评论")
            logger.info("可能的原因:")
            logger.info("  1. App Store ID不正确")
            logger.info("  2. 该游戏没有评论")
            logger.info("  3. 网络连接问题")
            logger.info("  4. 被反爬虫机制阻止")
            return False
            
    except ImportError as e:
        logger.error(f"❌ 导入错误: {str(e)}")
        logger.error("请先安装依赖: pip install app-store-scraper")
        return False
    except Exception as e:
        logger.error(f"❌ 测试失败: {str(e)}", exc_info=True)
        return False


if __name__ == "__main__":
    success = test_appstore_scraper()
    if success:
        print("\n✓ 测试成功！可以继续运行完整采集流程。")
    else:
        print("\n✗ 测试失败，请检查错误信息。")

