"""
App Store 评论采集模块 - 使用Playwright（更稳定的替代方案）
"""
import json
import time
import logging
import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
except ImportError:
    sync_playwright = None
    logging.warning("playwright 未安装，请运行: pip install playwright && playwright install chromium")

logger = logging.getLogger(__name__)


class AppStoreScraperPlaywright:
    """App Store 评论采集器 - 使用Playwright模拟真实浏览器"""
    
    def __init__(self, delay: float = 3.0, retry_times: int = 3, headless: bool = True):
        """
        初始化采集器
        
        Args:
            delay: 请求间隔（秒）
            retry_times: 重试次数
            headless: 是否使用无头模式（False会显示浏览器窗口，便于调试）
        """
        self.delay = delay
        self.retry_times = retry_times
        self.headless = headless
        if sync_playwright is None:
            raise ImportError("请先安装 playwright: pip install playwright && playwright install chromium")
    
    def _parse_review_date(self, date_str: str) -> Optional[datetime]:
        """解析App Store评论日期"""
        if not date_str:
            return None
        
        # 尝试多种日期格式
        date_patterns = [
            r'(\d{1,2})/(\d{1,2})/(\d{4})',  # MM/DD/YYYY
            r'(\d{4})-(\d{2})-(\d{2})',      # YYYY-MM-DD
            r'(\d{1,2})\s+(\w+)\s+(\d{4})',  # DD Month YYYY
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, date_str)
            if match:
                try:
                    if '/' in date_str:
                        month, day, year = match.groups()
                        return datetime(int(year), int(month), int(day))
                    elif '-' in date_str:
                        year, month, day = match.groups()
                        return datetime(int(year), int(month), int(day))
                except:
                    continue
        
        return None
    
    def get_reviews(
        self,
        app_id: str,
        app_name: str,
        country: str = "us",
        days: int = 365,
        max_reviews: int = 5000,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict]:
        """
        获取App Store评论 - 使用Playwright
        
        Args:
            app_id: 应用ID
            app_name: 应用名称（用于日志）
            country: 国家代码
            days: 采集最近多少天的评论
            max_reviews: 最多采集的评论数
            start_date: 开始日期
            end_date: 结束日期
        
        Returns:
            评论列表
        """
        if not app_id:
            logger.warning(f"游戏 {app_name} 的 App Store ID 未配置，跳过采集")
            return []
        
        # 计算日期范围
        if end_date is None:
            end_date = datetime.now()
        if start_date is None:
            start_date = end_date - timedelta(days=days)
        
        reviews = []
        app_store_url = f"https://apps.apple.com/{country}/app/id{app_id}"
        
        logger.info(f"开始采集 {app_name} 的 App Store 评论 (ID: {app_id}, Country: {country})")
        logger.info(f"使用Playwright访问: {app_store_url}")
        logger.info(f"时间范围: {start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}")
        
        with sync_playwright() as p:
            try:
                # 启动浏览器
                browser = p.chromium.launch(headless=self.headless)
                context = browser.new_context(
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    viewport={'width': 1920, 'height': 1080}
                )
                page = context.new_page()
                
                # 访问App Store页面
                logger.info("正在加载App Store页面...")
                page.goto(app_store_url, wait_until='networkidle', timeout=30000)
                time.sleep(2)  # 等待页面完全加载
                
                # 尝试滚动到评论区域
                logger.info("正在查找评论区域...")
                try:
                    # 查找"Ratings and Reviews"部分
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                    time.sleep(1)
                    
                    # 尝试点击"See All Reviews"或类似按钮
                    see_all_button = page.query_selector('text=See All Reviews')
                    if see_all_button:
                        see_all_button.click()
                        time.sleep(2)
                except:
                    logger.warning("未找到'See All Reviews'按钮，尝试直接解析当前页面")
                
                # 解析评论
                logger.info("正在解析评论...")
                collected_count = 0
                
                # 尝试多次滚动加载更多评论
                for scroll_attempt in range(5):
                    if collected_count >= max_reviews:
                        break
                    
                    # 查找评论元素
                    review_elements = page.query_selector_all('.we-customer-review')
                    
                    if not review_elements:
                        # 尝试其他可能的选择器
                        review_elements = page.query_selector_all('[data-testid="review"]')
                    
                    if not review_elements:
                        # 尝试更通用的选择器
                        review_elements = page.query_selector_all('.review')
                    
                    logger.info(f"找到 {len(review_elements)} 个评论元素")
                    
                    # 解析每个评论
                    for element in review_elements:
                        if collected_count >= max_reviews:
                            break
                        
                        try:
                            # 提取评论内容
                            review_text = element.inner_text() if hasattr(element, 'inner_text') else ''
                            
                            # 尝试提取结构化数据
                            rating_elem = element.query_selector('.rating')
                            if not rating_elem:
                                rating_elem = element.query_selector('[aria-label*="star"]')
                            
                            rating = 0
                            if rating_elem:
                                rating_text = rating_elem.get_attribute('aria-label') or ''
                                rating_match = re.search(r'(\d+)', rating_text)
                                if rating_match:
                                    rating = int(rating_match.group(1))
                            
                            # 提取日期
                            date_elem = element.query_selector('time')
                            if not date_elem:
                                date_elem = element.query_selector('.date')
                            
                            review_date = None
                            if date_elem:
                                date_str = date_elem.get_attribute('datetime') or date_elem.inner_text()
                                review_date = self._parse_review_date(date_str)
                            
                            # 提取作者
                            author_elem = element.query_selector('.reviewer-name')
                            if not author_elem:
                                author_elem = element.query_selector('a[href*="user"]')
                            author = author_elem.inner_text() if author_elem else ''
                            
                            # 提取标题和内容
                            title_elem = element.query_selector('h3, .review-title')
                            title = title_elem.inner_text() if title_elem else ''
                            
                            content_elem = element.query_selector('.review-body, p')
                            content = content_elem.inner_text() if content_elem else review_text
                            
                            # 如果日期在范围内，添加到列表
                            if review_date and start_date <= review_date <= end_date:
                                processed_review = {
                                    'platform': 'ios',
                                    'game_name': app_name,
                                    'review_id': f"{app_id}_{collected_count}",
                                    'rating': rating,
                                    'title': title.strip(),
                                    'content': content.strip(),
                                    'date': review_date.isoformat(),
                                    'author': author.strip(),
                                    'helpful': 0,
                                    'country': country
                                }
                                reviews.append(processed_review)
                                collected_count += 1
                                
                                if collected_count % 10 == 0:
                                    logger.info(f"已采集 {collected_count} 条评论...")
                        
                        except Exception as e:
                            logger.warning(f"解析评论时出错: {str(e)}")
                            continue
                    
                    # 滚动加载更多
                    if scroll_attempt < 4:
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        time.sleep(2)
                
                browser.close()
                
                logger.info(f"成功采集 {len(reviews)} 条 {app_name} 的 App Store 评论")
                time.sleep(self.delay)
                
            except PlaywrightTimeout:
                logger.error("页面加载超时")
            except Exception as e:
                logger.error(f"采集 {app_name} App Store 评论时出错: {str(e)}", exc_info=True)
        
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
    scraper = AppStoreScraperPlaywright(headless=False)  # 显示浏览器窗口便于调试
    # reviews = scraper.get_reviews("6739124364", "TopTycoon", days=30, max_reviews=50)

