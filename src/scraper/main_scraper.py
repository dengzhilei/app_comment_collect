"""
主采集程序 - 统一调用App Store和Google Play采集器
"""
import yaml
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict

from .appstore_scraper import AppStoreScraper
from .playstore_scraper import PlayStoreScraper

logger = logging.getLogger(__name__)


class MainScraper:
    """主采集器，协调各个平台的采集"""
    
    def __init__(self, config_path: str = "config.yaml"):
        """
        初始化主采集器
        
        Args:
            config_path: 配置文件路径
        """
        self.config = self._load_config(config_path)
        self.appstore_scraper = AppStoreScraper(
            delay=self.config['scraper']['delay_between_requests'],
            retry_times=self.config['scraper']['retry_times']
        )
        self.playstore_scraper = PlayStoreScraper(
            delay=self.config['scraper']['delay_between_requests'],
            retry_times=self.config['scraper']['retry_times']
        )
    
    def _load_config(self, config_path: str) -> Dict:
        """加载配置文件"""
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def scrape_all_games(self) -> Dict[str, List[Dict]]:
        """
        采集所有游戏的评论
        
        Returns:
            字典，键为游戏名，值为评论列表
        """
        all_reviews = {}
        games = self.config['games']
        time_range = self.config['scraper']['time_range_days']
        max_reviews = self.config['scraper']['max_reviews_per_game']
        
        for game in games:
            game_name = game['name']
            logger.info(f"\n{'='*50}")
            logger.info(f"开始采集游戏: {game_name}")
            logger.info(f"{'='*50}\n")
            
            game_reviews = []
            
            # 采集iOS评论
            if 'ios' in game.get('platforms', []):
                appstore_id = game.get('appstore_id', '')
                if appstore_id:
                    try:
                        ios_reviews = self.appstore_scraper.get_reviews(
                            app_id=appstore_id,
                            app_name=game_name,
                            days=time_range,
                            max_reviews=max_reviews
                        )
                        game_reviews.extend(ios_reviews)
                        
                        # 保存iOS评论
                        if ios_reviews:
                            output_path = f"data/raw/{game_name}_ios_{datetime.now().strftime('%Y%m%d')}.json"
                            self.appstore_scraper.save_reviews(ios_reviews, output_path)
                    except Exception as e:
                        logger.error(f"采集 {game_name} iOS评论失败: {str(e)}")
                else:
                    logger.warning(f"{game_name} 的 App Store ID 未配置")
            
            # 采集Android评论
            if 'android' in game.get('platforms', []):
                playstore_id = game.get('playstore_id', '')
                if playstore_id:
                    # 获取配置的地区列表
                    regions = self.config['scraper'].get('regions', [{'lang': 'en', 'country': 'us', 'name': '美国'}])
                    
                    # 为每个地区采集评论
                    for region in regions:
                        lang = region.get('lang', 'en')
                        country = region.get('country', 'us')
                        region_name = region.get('name', f"{lang}_{country}")
                        
                        logger.info(f"采集 {game_name} 的 {region_name} 地区评论 (lang={lang}, country={country})")
                        
                        try:
                            android_reviews = self.playstore_scraper.get_reviews(
                                app_id=playstore_id,
                                app_name=game_name,
                                days=time_range,
                                max_reviews=max_reviews,
                                lang=lang,
                                country=country
                            )
                            game_reviews.extend(android_reviews)
                            
                            # 保存Android评论（按地区分别保存）
                            if android_reviews:
                                output_path = f"data/raw/{game_name}_android_{region_name}_{datetime.now().strftime('%Y%m%d')}.json"
                                self.playstore_scraper.save_reviews(android_reviews, output_path)
                                logger.info(f"{region_name} 地区采集了 {len(android_reviews)} 条评论")
                        except Exception as e:
                            logger.error(f"采集 {game_name} {region_name} 地区Android评论失败: {str(e)}")
                else:
                    logger.warning(f"{game_name} 的 Google Play ID 未配置")
            
            all_reviews[game_name] = game_reviews
            logger.info(f"\n{game_name} 总计采集 {len(game_reviews)} 条评论\n")
        
        return all_reviews


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    scraper = MainScraper()
    all_reviews = scraper.scrape_all_games()
    
    # 统计信息
    total_reviews = sum(len(reviews) for reviews in all_reviews.values())
    logger.info(f"\n{'='*50}")
    logger.info(f"采集完成！总计 {total_reviews} 条评论")
    logger.info(f"{'='*50}\n")

