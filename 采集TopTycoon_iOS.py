"""
TopTycoon iOS 数据采集脚本
时间范围: 2025年9月-12月
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
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('topycoon_ios_scrape.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def main():
    """主函数"""
    logger.info("="*60)
    logger.info("TopTycoon iOS 数据采集")
    logger.info("时间范围: 2025年9月-12月")
    logger.info("="*60)
    
    # 加载配置
    config_path = "config.yaml"
    if not Path(config_path).exists():
        logger.error(f"配置文件 {config_path} 不存在！")
        return
    
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
        return
    
    game_name = game_config['name']
    app_id = game_config.get('appstore_id', '')
    # 优先使用appstore_name，如果为空则使用name
    appstore_name = game_config.get('appstore_name', '') or game_name
    
    if not app_id:
        logger.error("TopTycoon的App Store ID未配置！")
        logger.info("请在config.yaml中填写appstore_id")
        return
    
    logger.info(f"✓ 找到配置：{game_name}")
    logger.info(f"  App Store ID: {app_id}")
    logger.info(f"  使用应用名称: '{appstore_name}'")
    if game_config.get('appstore_name'):
        logger.info(f"    (来自appstore_name配置)")
    else:
        logger.info(f"    (来自name字段，如需更改请填写appstore_name)")
    
    # 设置时间范围：2025年9月1日 - 2025年12月31日
    start_date = datetime(2025, 9, 1)
    end_date = datetime(2025, 12, 31, 23, 59, 59)
    
    logger.info(f"\n游戏: {game_name}")
    logger.info(f"App ID: {app_id}")
    logger.info(f"时间范围: {start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}")
    logger.info(f"地区: 美国 (en, us)\n")
    
    # 创建采集器
    scraper = AppStoreScraper(
        delay=config['scraper']['delay_between_requests'],
        retry_times=config['scraper']['retry_times']
    )
    
    # 开始采集
    logger.info("开始采集App Store评论...")
    logger.info("注意：App Store采集可能需要较长时间，请耐心等待...\n")
    
    reviews = scraper.get_reviews(
        app_id=app_id,
        app_name=appstore_name,  # 使用配置的应用名称
        country='us',  # 美国区
        days=120,  # 这个参数会被start_date和end_date覆盖
        max_reviews=config['scraper']['max_reviews_per_game']
    )
    
    if not reviews:
        logger.error("没有采集到任何数据！")
        logger.info("可能的原因：")
        logger.info("  1. App Store ID不正确")
        logger.info("  2. 该时间段内没有评论")
        logger.info("  3. 网络连接问题")
        return
    
    # 过滤日期范围
    filtered_reviews = []
    for review in reviews:
        review_date_str = review.get('date', '')
        if review_date_str:
            try:
                if isinstance(review_date_str, str):
                    review_date = datetime.fromisoformat(review_date_str.replace('Z', '+00:00'))
                else:
                    review_date = review_date_str
                
                if start_date <= review_date <= end_date:
                    filtered_reviews.append(review)
            except:
                # 如果日期解析失败，保留该评论
                filtered_reviews.append(review)
    
    logger.info(f"\n✓ 采集成功！")
    logger.info(f"  总采集: {len(reviews)} 条评论")
    logger.info(f"  时间范围内: {len(filtered_reviews)} 条评论")
    
    if not filtered_reviews:
        logger.warning("在指定时间范围内没有找到评论！")
        return
    
    # 保存数据
    output_path = f"data/raw/{game_name.replace(' ', '_')}_ios_美国_202509-202512.json"
    scraper.save_reviews(filtered_reviews, output_path)
    
    # 统计信息
    if filtered_reviews:
        ratings = [r.get('rating', 0) for r in filtered_reviews if r.get('rating')]
        if ratings:
            avg_rating = sum(ratings) / len(ratings)
            logger.info(f"\n统计信息:")
            logger.info(f"  平均评分: {avg_rating:.2f}")
            rating_dist = {}
            for r in set(ratings):
                rating_dist[int(r)] = ratings.count(r)
            logger.info(f"  评分分布: {rating_dist}")
    
    logger.info("\n" + "="*60)
    logger.info("采集完成！")
    logger.info("="*60)
    logger.info(f"\n数据已保存到: {output_path}")
    logger.info(f"\n下一步：运行 '运行粗筛.bat' 进行评论筛选")
    logger.info("="*60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n\n用户中断程序")
    except Exception as e:
        logger.error(f"程序执行出错: {str(e)}", exc_info=True)

