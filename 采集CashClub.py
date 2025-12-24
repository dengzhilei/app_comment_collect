"""
Cash Club 数据采集脚本
"""
import logging
import json
import yaml
from pathlib import Path
from datetime import datetime

from src.scraper.playstore_scraper import PlayStoreScraper

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cash_club_scrape.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def main():
    """主函数"""
    logger.info("="*60)
    logger.info("Cash Club 数据采集")
    logger.info("="*60)
    
    # 加载配置
    config_path = "config.yaml"
    if not Path(config_path).exists():
        logger.error(f"配置文件 {config_path} 不存在！")
        return
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    # 查找Cash Club配置
    game_config = None
    for game in config['games']:
        if game['name'] == 'Cash Club':
            game_config = game
            break
    
    if not game_config:
        logger.error("未找到Cash Club配置！")
        return
    
    game_name = game_config['name']
    app_id = game_config.get('playstore_id', '')
    
    if not app_id:
        logger.error("Cash Club的Google Play ID未配置！")
        logger.info("请在config.yaml中填写playstore_id")
        return
    
    logger.info(f"✓ 找到配置：{game_name}")
    logger.info(f"  Google Play ID: {app_id}")
    
    # 设置时间范围：2024年12月之前（已抓取12月的5000条，现在抓取更早的500条）
    end_date = datetime(2024, 11, 30)  # 2024年11月30日（12月之前）
    start_date = datetime(2024, 1, 1)  # 从2024年1月1日开始
    
    logger.info(f"\n游戏: {game_name}")
    logger.info(f"App ID: {app_id}")
    logger.info(f"时间范围: {start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')} (12月之前)")
    logger.info(f"最大评论数: 5000条")
    logger.info(f"地区: 美国 (en, us)\n")
    
    # 获取地区配置
    region = config['scraper'].get('regions', [{'lang': 'en', 'country': 'us', 'name': '美国'}])[0]
    
    # 创建采集器
    scraper = PlayStoreScraper(
        delay=config['scraper']['delay_between_requests'],
        retry_times=config['scraper']['retry_times']
    )
    
    # 先验证应用信息
    logger.info("正在验证应用信息...")
    app_info = scraper.get_app_info(app_id, lang=region['lang'], country=region['country'])
    
    if app_info:
        logger.info(f"✓ 应用信息获取成功！")
        logger.info(f"  应用名称: {app_info.get('title', 'N/A')}")
        logger.info(f"  开发者: {app_info.get('developer', 'N/A')}")
        logger.info(f"  评分: {app_info.get('score', 'N/A')}")
        logger.info(f"  安装数: {app_info.get('installs', 'N/A')}\n")
    else:
        logger.warning("⚠ 无法获取应用信息，但继续尝试采集评论...\n")
    
    # 开始采集
    logger.info("开始采集评论...")
    reviews = scraper.get_reviews(
        app_id=app_id,
        app_name=game_name,
        days=365,  # 最近一年
        max_reviews=5000,  # 采集5000条（更早的评论）
        lang=region['lang'],
        country=region['country'],
        start_date=start_date,
        end_date=end_date
    )
    
    if not reviews:
        logger.error("没有采集到任何数据！")
        return
    
    logger.info(f"\n✓ 采集成功！共获取 {len(reviews)} 条评论")
    
    # 保存数据（文件名包含"early"标识，表示是更早的评论）
    output_path = f"data/raw/{game_name.replace(' ', '_')}_android_{region['name']}_early_{start_date.strftime('%Y%m')}-{end_date.strftime('%Y%m')}.json"
    scraper.save_reviews(reviews, output_path)
    
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
    logger.info("采集完成！")
    logger.info("="*60)
    logger.info(f"\n数据已保存到: {output_path}")
    logger.info(f"\n下一步：运行 '运行CashClub筛选.bat' 进行评论筛选")
    logger.info("="*60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n\n用户中断程序")
    except Exception as e:
        logger.error(f"程序执行出错: {str(e)}", exc_info=True)

