"""
通用评论采集脚本
使用方法: python -m src.scrape <游戏名称> [开始日期] [结束日期]
示例: python -m src.scrape "TopTycoon" 2025-09-01 2025-12-31
"""
import logging
import json
import sys
from pathlib import Path
from datetime import datetime

from src.scraper.playstore_scraper import PlayStoreScraper
from src.config import load_config, get_game_by_name, get_scraper_config, get_config_path

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scrape.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def main():
    """主函数"""
    # 解析命令行参数
    if len(sys.argv) < 2:
        logger.error("使用方法: python -m src.scrape <游戏名称> [开始日期] [结束日期]")
        logger.error("示例: python -m src.scrape \"TopTycoon\" 2025-09-01 2025-12-31")
        logger.error("示例: python -m src.scrape \"Sunday City: Life RolePlay\"")
        return
    
    game_name = sys.argv[1]
    
    # 解析日期参数（可选）
    start_date = None
    end_date = None
    if len(sys.argv) >= 3:
        try:
            start_date = datetime.strptime(sys.argv[2], '%Y-%m-%d')
        except ValueError:
            logger.error(f"开始日期格式错误，应为 YYYY-MM-DD，例如: 2025-09-01")
            return
    
    if len(sys.argv) >= 4:
        try:
            end_date = datetime.strptime(sys.argv[3], '%Y-%m-%d')
        except ValueError:
            logger.error(f"结束日期格式错误，应为 YYYY-MM-DD，例如: 2025-12-31")
            return
    
    # 默认时间范围：最近一年
    if not end_date:
        end_date = datetime.now()
    if not start_date:
        start_date = datetime(end_date.year - 1, end_date.month, end_date.day)
    
    logger.info("="*60)
    logger.info(f"开始采集: {game_name}")
    logger.info("="*60)
    
    # 加载配置
    if not get_config_path().exists():
        logger.error(f"配置文件 {get_config_path()} 不存在！")
        return
    
    config = load_config()
    game_config = get_game_by_name(game_name, config)
    
    if not game_config:
        logger.error(f"未找到游戏 '{game_name}' 的配置！")
        logger.info("请在 config.yaml 中配置该游戏")
        logger.info("可用游戏列表:")
        for game in config.get('games', []):
            logger.info(f"  - {game['name']}")
        return
    
    app_id = game_config.get('playstore_id', '')
    
    if not app_id:
        logger.error(f"{game_name} 的 Google Play ID 未配置！")
        logger.info("请在 config.yaml 中填写 playstore_id")
        return
    
    logger.info(f"✓ 找到配置：{game_name}")
    logger.info(f"  Google Play ID: {app_id}")
    
    logger.info(f"\n游戏: {game_name}")
    logger.info(f"App ID: {app_id}")
    logger.info(f"时间范围: {start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}")
    
    # 获取多地区配置（全球采集，每条评论会标注国家）
    scraper_config = get_scraper_config(config)
    regions = scraper_config.get('regions', [{'lang': 'en', 'country': 'us', 'name': '美国'}])
    logger.info(f"地区数: {len(regions)}（全球多地区）")
    for r in regions:
        logger.info(f"  - {r['name']} ({r['lang']}, {r['country']})")
    logger.info("")
    
    # 创建采集器
    scraper = PlayStoreScraper(
        delay=scraper_config['delay_between_requests'],
        retry_times=scraper_config['retry_times']
    )
    
    # 用第一个地区验证应用信息
    first_region = regions[0]
    logger.info("正在验证应用信息...")
    app_info = scraper.get_app_info(app_id, lang=first_region['lang'], country=first_region['country'])
    
    if app_info:
        logger.info(f"✓ 应用信息获取成功！")
        logger.info(f"  应用名称: {app_info.get('title', 'N/A')}")
        logger.info(f"  开发者: {app_info.get('developer', 'N/A')}")
        logger.info(f"  评分: {app_info.get('score', 'N/A')}")
        logger.info(f"  安装数: {app_info.get('installs', 'N/A')}\n")
    else:
        logger.warning("⚠ 无法获取应用信息，但继续尝试采集评论...\n")
    
    # 按地区循环采集，合并并标注国家（同一条评论在多个国家出现时，记录所有来源国家）
    reviews_by_id = {}  # review_id -> review，同一条会合并 country_names 列表
    max_per_region = scraper_config.get('max_reviews_per_game', 5000)
    
    for i, region in enumerate(regions, 1):
        logger.info(f"[{i}/{len(regions)}] 正在采集地区: {region['name']} ({region['country']})")
        region_reviews = scraper.get_reviews(
            app_id=app_id,
            app_name=game_name,
            days=365,
            max_reviews=max_per_region,
            lang=region['lang'],
            country=region['country'],
            start_date=start_date,
            end_date=end_date
        )
        for r in region_reviews:
            r['country_name'] = region['name']
            r['country_names'] = [region['name']]
        # 去重：同一 review_id 在不同国家接口返回的是同一条评论，只保留一条
        # 同语区（美/英/加等）接口返回的数据相同，无法区分评论者真实国家，只记录“从哪些国家接口抓到了这条”
        new_count = 0
        for r in region_reviews:
            rid = r.get('review_id')
            if not rid:
                continue
            if rid not in reviews_by_id:
                reviews_by_id[rid] = r
                new_count += 1
            else:
                existing = reviews_by_id[rid]
                for cn in r.get('country_names', [r.get('country_name')]):
                    if cn and cn not in existing.get('country_names', []):
                        existing.setdefault('country_names', []).append(cn)
        logger.info(f"  本地区新增 {new_count} 条（去重后总累计: {len(reviews_by_id)} 条）\n")
    
    reviews = list(reviews_by_id.values())
    
    if not reviews:
        logger.error("没有采集到任何数据！")
        return
    
    logger.info(f"\n✓ 全球采集完成！共获取 {len(reviews)} 条评论（已按 review_id 去重）")
    
    # 保存数据（处理游戏名称中的特殊字符）
    game_name_safe = game_name.replace(' ', '_').replace(':', '_').replace('&', '_')
    
    # 生成文件名（全球统一一个文件）
    if start_date.year == end_date.year and start_date.month == end_date.month:
        date_str = start_date.strftime('%Y%m')
    else:
        date_str = f"{start_date.strftime('%Y%m')}-{end_date.strftime('%Y%m')}"
    
    filename_suffix = ""
    if "early" in sys.argv or (start_date.year == 2024 and start_date.month == 1 and end_date.month == 11):
        filename_suffix = "_early"
    
    output_path = f"data/raw/{game_name_safe}_android_全球{filename_suffix}_{date_str}.json"
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
    logger.info(f"\n下一步：运行 '运行筛选.bat \"{game_name}\"' 进行评论筛选")
    logger.info("="*60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n\n用户中断程序")
    except Exception as e:
        logger.error(f"程序执行出错: {str(e)}", exc_info=True)

