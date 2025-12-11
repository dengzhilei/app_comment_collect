"""
评论筛选器 - 智能筛选有意义的评论
"""
import logging
import pandas as pd
import re

logger = logging.getLogger(__name__)


class ReviewFilter:
    """评论筛选器 - 过滤无意义的评论，保留有价值的反馈"""
    
    def __init__(self):
        """初始化筛选器"""
        pass
    
    def filter_meaningful_reviews(self, df: pd.DataFrame, min_length: int = 20) -> pd.DataFrame:
        """
        筛选有意义的评论
        
        过滤标准：
        1. 长度要求
        2. 排除简单词汇
        3. 包含具体内容
        
        Args:
            df: 评论DataFrame
            min_length: 最小长度要求
        
        Returns:
            筛选后的DataFrame
        """
        if df.empty:
            return df
        
        original_count = len(df)
        
        # 过滤过短评论
        df = df[df['content_cleaned'].str.len() >= min_length]
        
        # 排除无意义的简单评论
        meaningless_patterns = [
            r'^\s*(fun|good|bad|great|nice|ok|okay|love|hate)\s*[!.]?\s*$',
            r'^\s*\d+\s*stars?\s*[!.]?\s*$',
            r'^\s*(5|4|3|2|1)\s*[!.]?\s*$',
        ]
        
        # 创建与df索引对齐的mask
        mask = pd.Series([True] * len(df), index=df.index)
        for pattern in meaningless_patterns:
            mask = mask & (~df['content_cleaned'].str.match(pattern, case=False, na=False))
        
        df = df[mask]
        
        # 要求包含至少一个具体词汇（游戏相关、问题描述等）
        meaningful_keywords = [
            'game', 'play', 'level', 'coin', 'money', 'buy', 'purchase',
            'bug', 'crash', 'error', 'problem', 'issue', 'fix',
            'update', 'new', 'add', 'remove', 'change', 'improve',
            'difficult', 'easy', 'hard', 'balance', 'unfair',
            'graphics', 'sound', 'music', 'visual', 'design',
            'time', 'wait', 'slow', 'fast', 'lag', 'freeze'
        ]
        
        # 确保索引对齐
        has_keyword = df['content_cleaned'].str.lower().str.contains(
            '|'.join(meaningful_keywords), na=False, regex=True
        )
        # 重置索引以确保对齐
        df = df.reset_index(drop=True)
        has_keyword = has_keyword.reset_index(drop=True)
        df = df[has_keyword]
        
        logger.info(f"筛选后保留 {len(df)} 条有意义的评论（原始: {original_count} 条）")
        
        return df


if __name__ == "__main__":
    # 测试代码
    logging.basicConfig(level=logging.INFO)
    filter_tool = ReviewFilter()
    
    test_reviews = pd.DataFrame({
        'content_cleaned': [
            "This game is fun!",
            "The coin system is broken. I spent $10 and got nothing. This needs to be fixed immediately.",
            "Great game but needs more levels",
            "5 stars"
        ],
        'rating': [5, 1, 4, 5]
    })
    
    filtered = filter_tool.filter_meaningful_reviews(test_reviews)
    print(f"筛选后: {len(filtered)} 条")
    print(filtered[['content_cleaned', 'rating']])

