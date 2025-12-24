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
    
    def get_app_info(self, app_id: str, app_name: str, country: str = "us") -> Optional[Dict]:
        """获取应用基本信息（用于验证ID）"""
        try:
            app = AppStore(country=country, app_name=app_name, app_id=app_id)
            # 尝试获取应用详情
            app_details = {
                'id': app_id,
                'name': app_name,
                'country': country
            }
            return app_details
        except Exception as e:
            logger.error(f"获取应用信息失败: {str(e)}")
            return None
    
    def get_reviews(
        self,
        app_id: str,
        app_name: str,
        country: str = "us",
        days: int = 365,
        max_reviews: int = 5000
    ) -> List[Dict]:
        """
        获取App Store评论
        
        Args:
            app_id: 应用ID
            app_name: 应用名称
            country: 国家代码（默认美国）
            days: 采集最近多少天的评论
            max_reviews: 最多采集的评论数
        
        Returns:
            评论列表
        """
        if not app_id:
            logger.warning(f"游戏 {app_name} 的 App Store ID 未配置，跳过采集")
            return []
        
        reviews = []
        
        # 尝试多个应用名称变体（如果主要名称失败）
        app_name_variants = [
            app_name,  # 原始名称
            app_name.lower(),  # 小写
            app_name.replace(' ', ''),  # 无空格
            app_name.replace(' ', '-'),  # 空格替换为连字符
        ]
        
        # 如果app_name包含特定关键词，尝试其他变体
        if 'tycoon' in app_name.lower():
            app_name_variants.extend([
                'Top Tycoon',
                'top-tycoon',
                'Monopoly Dream Idle King',
                'monopoly-dream-idle-king'
            ])
        
        # 去重
        app_name_variants = list(dict.fromkeys(app_name_variants))
        
        last_error = None
        successful_name = None
        app = None
        start_date = None
        end_date = None
        
        for variant_name in app_name_variants:
            try:
                logger.info(f"尝试应用名称: '{variant_name}' (ID: {app_id}, Country: {country})")
                
                # 创建AppStore对象
                test_app = AppStore(country=country, app_name=variant_name, app_id=app_id)
                
                # 计算日期范围
                end_date = datetime.now()
                start_date = end_date - timedelta(days=days)
                
                logger.info(f"时间范围: {start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}")
                logger.info(f"开始采集评论（最多 {max_reviews} 条）...")
                
                # 采集评论（添加错误处理和重试）
                max_attempts = 3
                attempt_delay = 3  # 每次重试的延迟（秒）
                
                for attempt in range(max_attempts):
                    try:
                        if attempt > 0:
                            logger.info(f"  重试第 {attempt} 次（延迟 {attempt_delay * attempt} 秒）...")
                            time.sleep(attempt_delay * attempt)
                        
                        test_app.review(how_many=max_reviews)
                        
                        # 检查是否真的获取到了评论
                        if hasattr(test_app, 'reviews') and len(test_app.reviews) > 0:
                            # 成功获取评论
                            app = test_app
                            successful_name = variant_name
                            logger.info(f"✓ 成功使用应用名称: '{successful_name}'，获取到 {len(test_app.reviews)} 条评论")
                            break  # 跳出重试循环
                        else:
                            # 没有获取到评论，可能是反爬虫或真的没有评论
                            if attempt < max_attempts - 1:
                                logger.warning(f"  未获取到评论，可能是反爬虫机制，等待后重试...")
                                continue
                            else:
                                logger.warning(f"应用名称 '{variant_name}' 尝试 {max_attempts} 次后仍未获取到评论")
                                last_error = "未获取到任何评论（可能是反爬虫机制或该应用确实没有评论）"
                                break  # 跳出重试循环，尝试下一个名称
                                
                    except ValueError as json_error:
                        # JSON解析错误，可能是反爬虫返回了HTML
                        error_msg = str(json_error)
                        if "Expecting value" in error_msg or "JSON" in error_msg:
                            if attempt < max_attempts - 1:
                                logger.warning(f"  JSON解析错误（可能是反爬虫），等待 {attempt_delay * (attempt + 1)} 秒后重试...")
                                time.sleep(attempt_delay * (attempt + 1))
                                continue
                            else:
                                logger.warning(f"应用名称 '{variant_name}' JSON解析失败（可能是反爬虫机制）: {error_msg[:100]}")
                                last_error = json_error
                                break  # 跳出重试循环
                        else:
                            logger.warning(f"应用名称 '{variant_name}' 失败: {error_msg[:100]}")
                            last_error = json_error
                            break
                    except Exception as e:
                        error_msg = str(e)
                        if attempt < max_attempts - 1:
                            logger.warning(f"  错误: {error_msg[:50]}，等待后重试...")
                            time.sleep(attempt_delay * (attempt + 1))
                            continue
                        else:
                            logger.warning(f"应用名称 '{variant_name}' 失败: {error_msg[:100]}")
                            last_error = e
                            break
                
                # 如果成功获取到评论，跳出名称变体循环
                if successful_name and app is not None:
                    break
                    
            except Exception as e:
                logger.warning(f"创建AppStore对象失败 (名称: '{variant_name}'): {str(e)[:100]}")
                last_error = e
                continue
        
        if not successful_name or app is None:
            error_msg = str(last_error) if last_error else "未知错误"
            logger.error(f"所有应用名称变体都失败了。最后错误: {error_msg}")
            logger.error("建议：")
            logger.error(f"  1. 手动访问 https://apps.apple.com/us/app/id{app_id} 查看确切的应用名称")
            logger.error("  2. 将确切的应用名称填入 config.yaml 的 appstore_name 字段")
            logger.error("  3. 检查网络连接和是否被反爬虫机制阻止")
            return []
        
        # 检查是否真的获取到了评论
        if not hasattr(app, 'reviews') or len(app.reviews) == 0:
            logger.warning("⚠ 虽然应用名称正确，但未获取到任何评论")
            logger.warning("可能的原因：")
            logger.warning("  1. App Store反爬虫机制阻止了请求")
            logger.warning("  2. 该应用在指定时间范围内确实没有评论")
            logger.warning("  3. 网络连接问题")
            logger.info("建议：")
            logger.info("  - 等待几分钟后重试")
            logger.info("  - 检查网络连接")
            logger.info(f"  - 手动访问 https://apps.apple.com/us/app/id{app_id} 查看是否有评论")
            return []
        
        # 处理评论数据
        try:
            logger.info(f"原始采集到 {len(app.reviews)} 条评论，开始处理...")
            
            # 处理评论数据
            for review in app.reviews:
                review_date = review.get('date', datetime.now())
                
                # 处理日期格式
                if isinstance(review_date, str):
                    try:
                        review_date = datetime.fromisoformat(review_date.replace('Z', '+00:00'))
                    except:
                        try:
                            # 尝试其他日期格式
                            review_date = datetime.strptime(review_date, '%Y-%m-%d %H:%M:%S')
                        except:
                            review_date = datetime.now()
                elif isinstance(review_date, datetime):
                    pass
                else:
                    review_date = datetime.now()
                
                # 过滤日期范围
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
            
            logger.info(f"时间范围内保留 {len(reviews)} 条评论")
            logger.info(f"成功采集 {len(reviews)} 条 {app_name} 的 App Store 评论")
            time.sleep(self.delay)
            
        except Exception as e:
            logger.error(f"处理评论数据时出错: {str(e)}", exc_info=True)
            # 重试逻辑
            for i in range(self.retry_times - 1):
                try:
                    logger.info(f"重试 {i+1}/{self.retry_times-1}...")
                    time.sleep(self.delay * (i + 1))
                    app = AppStore(country=country, app_name=app_name, app_id=app_id)
                    app.review(how_many=max_reviews)
                    
                    # 处理评论
                    for review in app.reviews:
                        review_date = review.get('date', datetime.now())
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

