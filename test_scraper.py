"""
测试脚本 - 测试单个游戏的数据采集
"""
import logging
import json
from pathlib import Path
from datetime import datetime

from src.scraper.playstore_scraper import PlayStoreScraper

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def test_playstore_scraper(lang='en', country='us', region_name='美国'):
    """测试Google Play评论采集"""
    
    # 测试配置
    game_name = "Animals & Coins"
    app_id = "com.innplaylabs.animalkingdomraid"
    days = 365  # 最近一年
    max_reviews = 100  # 测试时只采集100条
    
    logger.info("="*60)
    logger.info(f"开始测试采集: {game_name}")
    logger.info(f"App ID: {app_id}")
    logger.info(f"时间范围: 最近 {days} 天")
    logger.info(f"最大评论数: {max_reviews}")
    logger.info("="*60)
    
    try:
        # 创建采集器
        scraper = PlayStoreScraper(delay=2.0, retry_times=3)
        
        # 先获取应用信息（验证ID是否正确）
        logger.info(f"\n正在验证应用信息 (地区: {region_name}, lang={lang}, country={country})...")
        app_info = scraper.get_app_info(app_id, lang=lang, country=country)
        
        if app_info:
            logger.info(f"✓ 应用信息获取成功！")
            logger.info(f"  应用名称: {app_info.get('title', 'N/A')}")
            logger.info(f"  开发者: {app_info.get('developer', 'N/A')}")
            logger.info(f"  评分: {app_info.get('score', 'N/A')}")
            logger.info(f"  安装数: {app_info.get('installs', 'N/A')}")
        else:
            logger.warning("⚠ 无法获取应用信息，但继续尝试采集评论...")
        
        # 采集评论
        logger.info(f"\n开始采集评论 (地区: {region_name})...")
        reviews = scraper.get_reviews(
            app_id=app_id,
            app_name=game_name,
            days=days,
            max_reviews=max_reviews,
            lang=lang,
            country=country
        )
        
        if reviews:
            logger.info(f"\n✓ 采集成功！共获取 {len(reviews)} 条评论")
            
            # 显示前几条评论示例
            logger.info("\n前3条评论示例:")
            for i, review in enumerate(reviews[:3], 1):
                logger.info(f"\n评论 {i}:")
                logger.info(f"  评分: {review.get('rating', 'N/A')}")
                logger.info(f"  日期: {review.get('date', 'N/A')}")
                logger.info(f"  内容: {review.get('content', '')[:100]}...")
            
            # 保存测试数据
            output_dir = Path("data/raw")
            output_dir.mkdir(parents=True, exist_ok=True)
            
            output_file = output_dir / f"{game_name.replace(' ', '_')}_android_{region_name}_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
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
                    logger.info(f"  评分分布: {dict(zip(*zip(*[(r, ratings.count(r)) for r in set(ratings)])))}")
            
            logger.info("\n" + "="*60)
            logger.info("测试完成！")
            logger.info("="*60)
            
            return True
        else:
            logger.warning("⚠ 未采集到任何评论")
            logger.info("可能的原因:")
            logger.info("  1. 游戏ID不正确")
            logger.info("  2. 该游戏没有评论")
            logger.info("  3. 网络连接问题")
            logger.info("  4. 被反爬虫机制阻止")
            return False
            
    except ImportError as e:
        logger.error(f"❌ 导入错误: {str(e)}")
        logger.error("请先安装依赖: pip install -r requirements.txt")
        return False
    except Exception as e:
        logger.error(f"❌ 测试失败: {str(e)}", exc_info=True)
        return False


if __name__ == "__main__":
    import sys
    
    # 支持命令行参数指定地区
    # 用法: python test_scraper.py en us 美国
    if len(sys.argv) >= 3:
        lang = sys.argv[1]
        country = sys.argv[2]
        region_name = sys.argv[3] if len(sys.argv) > 3 else f"{lang}_{country}"
    else:
        # 默认使用美国区
        lang = 'en'
        country = 'us'
        region_name = '美国'
        print("使用默认配置: 美国区 (en, us)")
        print("如需测试其他地区，可以运行: python test_scraper.py <lang> <country> <region_name>")
        print("例如: python test_scraper.py zh cn 中国")
        print()
    
    success = test_playstore_scraper(lang=lang, country=country, region_name=region_name)
    if success:
        print("\n✓ 测试成功！可以继续运行完整分析流程。")
    else:
        print("\n✗ 测试失败，请检查错误信息。")

