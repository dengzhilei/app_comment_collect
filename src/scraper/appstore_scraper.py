"""
App Store 评论采集模块
"""
import json
import time
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from pathlib import Path

try:
    from app_store_scraper import AppStore
except ImportError:
    AppStore = None
    logging.warning("app-store-scraper 未安装，请运行: pip install app-store-scraper")

logger = logging.getLogger(__name__)


class AppStoreScraper:
    """App Store 评论采集器"""
    
    def __init__(self, delay: float = 2.0, retry_times: int = 3):
        """
        初始化采集器
        
        Args:
            delay: 请求间隔（秒）
            retry_times: 重试次数
        """
        self.delay = delay
        self.retry_times = retry_times
        if AppStore is None:
            raise ImportError("请先安装 app-store-scraper: pip install app-store-scraper")
    
    def get_reviews(
        self,
        app_id: str,
        app_name: str,
        country: str = "cn",
        days: int = 365,
        max_reviews: int = 5000
    ) -> List[Dict]:
        """
        获取App Store评论
        
        Args:
            app_id: 应用ID
            app_name: 应用名称
            country: 国家代码（默认中国）
            days: 采集最近多少天的评论
            max_reviews: 最多采集的评论数
        
        Returns:
            评论列表
        """
        if not app_id:
            logger.warning(f"游戏 {app_name} 的 App Store ID 未配置，跳过采集")
            return []
        
        reviews = []
        try:
            logger.info(f"开始采集 {app_name} 的 App Store 评论 (ID: {app_id})")
            
            app = AppStore(country=country, app_name=app_name, app_id=app_id)
            
            # 计算日期范围
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # 采集评论
            app.review(how_many=max_reviews)
            
            # 处理评论数据
            for review in app.reviews:
                review_date = review.get('date', datetime.now())
                
                # 过滤日期范围
                if isinstance(review_date, str):
                    try:
                        review_date = datetime.fromisoformat(review_date.replace('Z', '+00:00'))
                    except:
                        review_date = datetime.now()
                
                if review_date >= start_date:
                    processed_review = {
                        'platform': 'ios',
                        'game_name': app_name,
                        'review_id': review.get('id', ''),
                        'rating': review.get('rating', 0),
                        'title': review.get('title', ''),
                        'content': review.get('review', ''),
                        'date': review_date.isoformat(),
                        'author': review.get('userName', ''),
                        'helpful': review.get('helpful', 0),
                        'country': country
                    }
                    reviews.append(processed_review)
            
            logger.info(f"成功采集 {len(reviews)} 条 {app_name} 的 App Store 评论")
            time.sleep(self.delay)
            
        except Exception as e:
            logger.error(f"采集 {app_name} App Store 评论时出错: {str(e)}")
            # 重试逻辑
            for i in range(self.retry_times - 1):
                try:
                    time.sleep(self.delay * (i + 1))
                    app = AppStore(country=country, app_name=app_name, app_id=app_id)
                    app.review(how_many=max_reviews)
                    # 处理逻辑同上...
                    break
                except Exception as retry_e:
                    logger.warning(f"重试 {i+1}/{self.retry_times-1} 失败: {str(retry_e)}")
        
        return reviews
    
    def save_reviews(self, reviews: List[Dict], output_path: str):
        """保存评论到文件"""
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(reviews, f, ensure_ascii=False, indent=2)
        
        logger.info(f"评论已保存到: {output_file}")


if __name__ == "__main__":
    # 测试代码
    logging.basicConfig(level=logging.INFO)
    scraper = AppStoreScraper()
    # 测试时需要提供真实的app_id
    # reviews = scraper.get_reviews("123456789", "Test App", days=30, max_reviews=100)

