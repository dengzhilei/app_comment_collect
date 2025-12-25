"""
Google Play Store 评论采集模块
"""
import json
import time
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from pathlib import Path

try:
    from tqdm import tqdm
except ImportError:
    tqdm = None

try:
    from google_play_scraper import app, reviews, Sort
except ImportError:
    try:
        # 尝试另一个可能的包名
        from googleplay_scraper import app, reviews, Sort
    except ImportError:
        app = None
        reviews = None
        Sort = None
        logging.warning("google-play-scraper 未安装，请运行: pip install google-play-scraper")

logger = logging.getLogger(__name__)


class PlayStoreScraper:
    """Google Play Store 评论采集器"""
    
    def __init__(self, delay: float = 2.0, retry_times: int = 3):
        """
        初始化采集器
        
        Args:
            delay: 请求间隔（秒）
            retry_times: 重试次数
        """
        self.delay = delay
        self.retry_times = retry_times
        if reviews is None:
            raise ImportError("请先安装 google-play-scraper: pip install google-play-scraper")
    
    def get_app_info(self, app_id: str, lang: str = 'en', country: str = 'us') -> Optional[Dict]:
        """获取应用基本信息"""
        try:
            result = app(app_id, lang=lang, country=country)
            return result
        except Exception as e:
            logger.error(f"获取应用信息失败 {app_id}: {str(e)}")
            return None
    
    def get_app_info(self, app_id: str, lang: str = 'en', country: str = 'us') -> Optional[Dict]:
        """获取应用基本信息"""
        try:
            result = app(app_id, lang=lang, country=country)
            return result
        except Exception as e:
            logger.error(f"获取应用信息失败 {app_id}: {str(e)}")
            return None
    
    def get_reviews(
        self,
        app_id: str,
        app_name: str,
        days: int = 365,
        max_reviews: int = 5000,
        lang: str = 'en',
        country: str = 'us',
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict]:
        """
        获取Google Play评论
        
        Args:
            app_id: 应用包名（如 com.example.app）
            app_name: 应用名称
            days: 采集最近多少天的评论（如果未指定start_date和end_date）
            max_reviews: 最多采集的评论数
            lang: 语言代码
            country: 国家代码
            start_date: 开始日期（可选，如果指定则覆盖days参数）
            end_date: 结束日期（可选，默认当前时间）
        
        Returns:
            评论列表
        """
        if not app_id:
            logger.warning(f"游戏 {app_name} 的 Google Play ID 未配置，跳过采集")
            return []
        
        all_reviews = []
        continuation_token = None
        collected_count = 0
        
        try:
            logger.info(f"开始采集 {app_name} 的 Google Play 评论 (ID: {app_id})")
            
            # 计算日期范围
            if end_date is None:
                end_date = datetime.now()
            if start_date is None:
                start_date = end_date - timedelta(days=days)
            
            logger.info(f"时间范围: {start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}")
            logger.info(f"目标采集数量: {max_reviews} 条")
            logger.info("开始采集，请耐心等待...\n")
            
            batch_num = 0
            while collected_count < max_reviews:
                batch_num += 1
                try:
                    # 显示进度
                    progress_pct = (collected_count / max_reviews * 100) if max_reviews > 0 else 0
                    logger.info(f"[批次 {batch_num}] 正在采集... (已采集: {collected_count}/{max_reviews} 条, {progress_pct:.1f}%)")
                    
                    # 采集评论（按时间排序）
                    result, continuation_token = reviews(
                        app_id,
                        lang=lang,
                        country=country,
                        sort=Sort.NEWEST,
                        count=200,  # 每次最多200条
                        continuation_token=continuation_token
                    )
                    
                    if not result:
                        break
                    
                    # 处理评论
                    batch_reviews = []
                    for review in result:
                        review_date = review.get('at', datetime.now())
                        
                        # 如果是时间戳，转换为datetime
                        if isinstance(review_date, (int, float)):
                            review_date = datetime.fromtimestamp(review_date / 1000)
                        elif isinstance(review_date, str):
                            try:
                                review_date = datetime.fromisoformat(review_date.replace('Z', '+00:00'))
                            except:
                                review_date = datetime.now()
                        
                        # 检查是否在时间范围内
                        if review_date < start_date:
                            # 如果评论日期早于起始日期，停止采集
                            continuation_token = None
                            break
                        elif review_date > end_date:
                            # 如果评论日期晚于结束日期，跳过这条评论
                            continue
                        
                        processed_review = {
                            'platform': 'android',
                            'game_name': app_name,
                            'review_id': review.get('reviewId', ''),
                            'rating': review.get('score', 0),
                            'title': '',  # Google Play评论没有标题
                            'content': review.get('content', ''),
                            'date': review_date.isoformat(),
                            'author': review.get('userName', ''),
                            'helpful': review.get('thumbsUpCount', 0),
                            'country': country,
                            'app_version': review.get('appVersion', '')
                        }
                        batch_reviews.append(processed_review)
                        collected_count += 1
                        
                        if collected_count >= max_reviews:
                            break
                    
                    all_reviews.extend(batch_reviews)
                    
                    # 显示本批次结果
                    if batch_reviews:
                        latest_date = max([r.get('date', '') for r in batch_reviews if r.get('date')], default='')
                        logger.info(f"[批次 {batch_num}] ✓ 本批次采集 {len(batch_reviews)} 条评论 (总计: {len(all_reviews)} 条)")
                        if latest_date:
                            try:
                                latest_dt = datetime.fromisoformat(latest_date.replace('Z', '+00:00'))
                                logger.info(f"        最新评论日期: {latest_dt.strftime('%Y-%m-%d %H:%M:%S')}")
                            except:
                                pass
                    else:
                        logger.info(f"[批次 {batch_num}] ⚠ 本批次未采集到符合条件的评论")
                    
                    # 如果没有更多评论，退出循环
                    if not continuation_token:
                        logger.info("已到达评论列表末尾，停止采集")
                        break
                    
                    # 延迟避免请求过快
                    logger.info(f"等待 {self.delay} 秒后继续...")
                    time.sleep(self.delay)
                    
                except Exception as e:
                    logger.error(f"采集批次时出错: {str(e)}")
                    # 重试
                    for i in range(self.retry_times - 1):
                        try:
                            time.sleep(self.delay * (i + 1))
                            result, continuation_token = reviews(
                                app_id,
                                lang=lang,
                                country=country,
                                sort=Sort.NEWEST,
                                count=200,
                                continuation_token=continuation_token
                            )
                            break
                        except Exception as retry_e:
                            logger.warning(f"重试 {i+1}/{self.retry_times-1} 失败: {str(retry_e)}")
                    else:
                        break
            
            logger.info("\n" + "="*60)
            logger.info(f"✓ 采集完成！")
            logger.info(f"  总计采集: {len(all_reviews)} 条评论")
            logger.info(f"  采集批次: {batch_num} 批")
            logger.info(f"  时间范围: {start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}")
            logger.info("="*60)
            
        except Exception as e:
            logger.error(f"采集 {app_name} Google Play 评论时出错: {str(e)}")
        
        return all_reviews
    
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
    scraper = PlayStoreScraper()
    # 测试时需要提供真实的app_id
    # reviews = scraper.get_reviews("com.example.app", "Test App", days=30, max_reviews=100)

