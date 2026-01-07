"""
数据清洗模块
"""
import pandas as pd
import logging
from typing import List, Dict
from datetime import datetime
import re

logger = logging.getLogger(__name__)


class DataCleaner:
    """数据清洗器"""
    
    def __init__(self):
        """初始化清洗器"""
        pass
    
    def clean_reviews(self, reviews: List[Dict]) -> pd.DataFrame:
        """
        清洗评论数据
        
        Args:
            reviews: 原始评论列表
        
        Returns:
            清洗后的DataFrame
        """
        if not reviews:
            logger.warning("评论列表为空")
            return pd.DataFrame()
        
        df = pd.DataFrame(reviews)
        
        # 去除重复评论
        initial_count = len(df)
        df = df.drop_duplicates(subset=['review_id', 'platform', 'game_name'], keep='first')
        removed_duplicates = initial_count - len(df)
        if removed_duplicates > 0:
            logger.info(f"去除 {removed_duplicates} 条重复评论")
        
        # 处理缺失值
        df['content'] = df['content'].fillna('')
        df['title'] = df['title'].fillna('')
        df['rating'] = pd.to_numeric(df['rating'], errors='coerce').fillna(0)
        
        # 统一时间格式
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df = df.dropna(subset=['date'])  # 删除日期无效的记录
        
        # 标准化评分（确保在1-5范围内）
        df['rating'] = df['rating'].clip(lower=1, upper=5)
        
        # 去除空内容评论
        df = df[df['content'].str.strip() != '']
        
        logger.info(f"清洗完成，保留 {len(df)} 条有效评论")
        
        return df
    
    def clean_text(self, text: str) -> str:
        """
        清洗文本内容
        
        Args:
            text: 原始文本
        
        Returns:
            清洗后的文本
        """
        if not isinstance(text, str):
            return ''
        
        # 去除HTML标签
        text = re.sub(r'<[^>]+>', '', text)
        
        # 去除多余的空白字符
        text = re.sub(r'\s+', ' ', text)
        
        # 去除特殊字符（保留中文、英文、数字、基本标点）
        text = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9\s.,!?;:()（）【】、。，！？；：]', '', text)
        
        return text.strip()
    
    def process_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        处理DataFrame，应用文本清洗
        
        Args:
            df: 原始DataFrame
        
        Returns:
            处理后的DataFrame
        """
        if df.empty:
            return df
        
        # 清洗文本内容
        df['content_cleaned'] = df['content'].apply(self.clean_text)
        df['title_cleaned'] = df['title'].apply(self.clean_text)
        
        # 计算文本长度
        df['content_length'] = df['content_cleaned'].str.len()
        
        # 过滤过短的评论（少于3个字符）
        df = df[df['content_length'] >= 3]
        
        return df


if __name__ == "__main__":
    # 测试代码
    logging.basicConfig(level=logging.INFO)
    cleaner = DataCleaner()
    
    # 测试数据
    test_reviews = [
        {
            'review_id': '1',
            'platform': 'ios',
            'game_name': 'Test Game',
            'rating': 5,
            'content': '很好玩！<br>推荐',
            'date': '2024-01-01T00:00:00'
        }
    ]
    
    df = cleaner.clean_reviews(test_reviews)
    print(df)

