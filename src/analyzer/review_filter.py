"""
评论筛选器 - 智能筛选有意义的评论
"""
import logging
import pandas as pd
import re
from typing import Dict, Tuple

logger = logging.getLogger(__name__)


class HolisticDesignScorer:
    """整体设计评分器 - 基于游戏设计视角的评论评分系统"""
    
    def __init__(self):
        # ==============================================================================
        # 1. 情绪爽点 (Emotional Hooks) - 宏观体验
        # ==============================================================================
        self.keywords_emotion = [
            r'\baddict(?:ive|ing|ed)\b',   # 上瘾
            r'\brelax(?:ing|ed)?\b',      # 放松
            r'\bsatisfy(?:ing|ed)\b',     # 满足感
            r'\btherapeutic\b',           # 治愈
            r'\bstress\s*free\b',         # 无压力
            r'\bobsess(?:ed|ion)\b',      # 痴迷
            r'\bdopamine\b',              # 多巴胺
            r'\bfun\b',                   # 好玩
            r'\blov(?:e|ing)\b',          # 爱
            r'\benjoy(?:able)?\b',        # 享受
            r'\bexciting\b',              # 兴奋
            r'\bamazing\b',               # 令人惊叹
            r'\bwonderful\b',             # 精彩
            r'\bengaging\b',              # 引人入胜
            r'\bentertaining\b'           # 娱乐性
        ]

        # ==============================================================================
        # 2. 感官与手感 (Sensory & Game Feel) - 微观交互细节
        # ==============================================================================
        self.keywords_sensory = [
            # 视觉表现
            r'\banimat(?:ion|ed)\b',      # 动画
            r'\breaction\b',              # 反应
            r'\bgraphic(s)?\b', r'\bvisual(s)?\b', r'\bart\b',
            r'\bcute\b', r'\badorabl(?:e)\b', # 可爱
            r'\bvibrant\b', r'\bdetail(s)?\b', # 细节
            r'\bfunny\b', r'\bhilarious\b',    # 搞笑
            r'\bbeautiful\b', r'\bstunning\b', # 美丽
            r'\bpolish(?:ed)?\b',         # 精致

            # 触觉与操作 (Game Juice)
            r'\bhaptic\b', r'\bvibrat(?:ion)?\b', # 震动
            r'\bsmooth\b', r'\bfluid\b',          # 流畅度
            r'\brespons(?:ive|e)\b',              # 响应速度
            r'\bone\s*hand(?:ed)?\b',             # 单手操作
            r'\bintuitive\b',                     # 直观
            r'\bcontrol(s)?\b',                   # 控制
            
            # 听觉
            r'\bsound\b', r'\bmusic\b', r'\bsfx\b', r'\bvoice\b',
            r'\baudio\b', r'\bmelody\b'
        ]

        # ==============================================================================
        # 3. 玩法与机制 (Gameplay Specifics) - 装修/收集/社交
        # ==============================================================================
        self.keywords_mechanics = [
            # 装修与个性化
            r'\bdecorat(?:e|ion)\b', r'\bfurnit(?:ure)?\b', 
            r'\bcustomiz(?:e|ation)\b', r'\bavatar\b', r'\boutfit\b',
            r'\bhouse\b', r'\bhome\b', r'\brenovat(?:e)\b',
            r'\bdesign\b', r'\bstyle\b',          # 设计/风格

            # 核心循环
            r'\bspin\b', r'\bwheel\b',            # 转盘
            r'\braid\b', r'\bsteal\b', r'\battack\b', # 互动
            r'\bcollect(?:ion)?\b', r'\balbum\b', # 收集
            r'\bmini\s*game\b', r'\bevent\b',     # 副玩法
            r'\bquest\b', r'\bmission\b',         # 任务
            r'\bupgrade\b', r'\bprogress(?:ion)?\b', # 升级/进度

            # 社交连接
            r'\bteam\b', r'\bclub\b', r'\bcommunit(?:y)?\b',
            r'\btrade\b', r'\btrading\b',         # 交换
            r'\bhelp\b', r'\bvisit\b',            # 互助
            r'\bfriend(s)?\b', r'\bsocial\b'      # 朋友/社交
        ]

        # ==============================================================================
        # 4. 愿望与脑洞 (Wishlist) - 未来的机会
        # ==============================================================================
        self.keywords_wishlist = [
            r'\bwish\b', r'\bhope\b', r'\bsuggest(?:ion)?\b',
            r'\bwould be (cool|great|better|awesome|nice)\b',
            r'\boption to\b', r'\bmiss(?:ing)?\b',
            r'\bfuture update\b', r'\bupdate\b',
            r'\bimprove(?:ment)?\b', r'\badd\b',  # 改进/添加
            r'\bneed(s)?\b', r'\bshould\b'        # 需要/应该
        ]


    def calculate_score(self, text: str, rating: int) -> Tuple[float, Dict]:
        """
        计算评论的综合评分
        
        Args:
            text: 评论文本
            rating: 评分 (1-5)
        
        Returns:
            (总分, 评分详情)
        """
        score = 0
        details = {}
        
        # 1. 评分逻辑：强调2-4星，4星>3星>2星，1星和5星不加分
        if rating == 4:
            score += 12  # 4星，最高权重
        elif rating == 3:
            score += 10  # 3星，次之
        elif rating == 2:
            score += 8  # 2星，最低
        # 1星和5星不加分也不扣分
            
        # 2. 情绪分 (The "Why") - 仅足够长文才有少量加分（大于100字符）
        text_len = len(text)
        if text_len > 100: 
            count_emo = sum(1 for p in self.keywords_emotion if re.search(p, text, re.IGNORECASE))
            s_emo = min(count_emo * 3, 12)  # 每个3分，最高12分（降低权重，仅长文）
            score += s_emo
            if s_emo > 0: 
                details['emotion'] = s_emo

        # 3. 感官细节分 (The "Feel") - 重点，保持高权重
        # 这是捕捉"动画"、"震动"、"手感"的关键
        count_sensory = sum(1 for p in self.keywords_sensory if re.search(p, text, re.IGNORECASE))
        s_sensory = min(count_sensory * 9, 45)  # 每个9分，最高45分（提高权重）
        score += s_sensory
        if s_sensory > 0: 
            details['sensory'] = s_sensory

        # 4. 机制分 (The "What") - 提高权重，机制描述很重要
        count_mech = sum(1 for p in self.keywords_mechanics if re.search(p, text, re.IGNORECASE))
        s_mech = min(count_mech * 6, 36)  # 每个6分，最高36分（提高权重）
        score += s_mech
        if s_mech > 0: 
            details['mechanics'] = s_mech

        # 5. 愿望清单分 (The "Future") - 保持高权重，建议类评论最有价值
        count_wish = sum(1 for p in self.keywords_wishlist if re.search(p, text, re.IGNORECASE))
        s_wish = min(count_wish * 10, 50)  # 每个10分，最高50分（提高上限）
        score += s_wish
        if s_wish > 0: 
            details['wishlist'] = s_wish

        # 6. 长度评分 - 提升权重，超长不扣分
        # 长度越长越好，不设上限扣分
        if text_len < 50:
            len_score = text_len / 2  # 短评论按比例给分
        elif text_len <= 200:
            len_score = 25 + (text_len - 50) / 10  # 50-200字符区间，最高40分
        elif text_len <= 500:
            len_score = 40 + (text_len - 200) / 15  # 200-500字符区间，最高60分
        else:
            len_score = 60 + (text_len - 500) / 20  # 超过500字符，继续加分但增速放缓
            len_score = min(len_score, 100)  # 最高100分，避免过长评论分数过高
        
        score += len_score
        details['length'] = round(len_score, 1)

        return round(score, 1), details


class ReviewFilter:
    """评论筛选器 - 过滤无意义的评论，保留有价值的反馈"""
    
    def __init__(self):
        """初始化筛选器"""
        self.scorer = HolisticDesignScorer()
    
    def filter_by_length(self, df: pd.DataFrame, min_length: int = 50) -> pd.DataFrame:
        """
        第一步：简单长度过滤
        
        Args:
            df: 评论DataFrame
            min_length: 最小长度要求
        
        Returns:
            筛选后的DataFrame
        """
        if df.empty:
            return df
        
        original_count = len(df)
        df = df[df['content_cleaned'].str.len() >= min_length]
        
        logger.info(f"长度过滤后保留 {len(df)} 条评论（原始: {original_count} 条）")
        
        return df
    
    def score_reviews(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        第二步：权重评分
        
        Args:
            df: 评论DataFrame
        
        Returns:
            添加了score和score_details列的DataFrame
        """
        if df.empty:
            return df
        
        def calculate_row_score(row):
            try:
                text = str(row.get('content_cleaned', ''))
                rating = row.get('rating', 0)
                # 确保rating是整数
                try:
                    rating = int(float(rating))
                except (ValueError, TypeError):
                    rating = 0
                # 确保rating在1-5范围内
                rating = max(1, min(5, rating))
                
                score, details = self.scorer.calculate_score(text, rating)
                return pd.Series({'score': score, 'score_details': details})
            except Exception as e:
                logger.warning(f"评分出错: {e}, 使用默认值")
                return pd.Series({'score': 0.0, 'score_details': {}})
        
        # 应用评分
        score_df = df.apply(calculate_row_score, axis=1)
        df = df.copy()
        df['score'] = score_df['score']
        df['score_details'] = score_df['score_details']
        
        logger.info(f"评分完成，平均分: {df['score'].mean():.1f}, 最高分: {df['score'].max():.1f}, 最低分: {df['score'].min():.1f}")
        
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
    
    # 测试长度过滤
    filtered = filter_tool.filter_by_length(test_reviews, min_length=20)
    print(f"长度过滤后: {len(filtered)} 条")
    print(filtered[['content_cleaned', 'rating']])
    
    # 测试评分
    if len(filtered) > 0:
        scored = filter_tool.score_reviews(filtered)
        print(f"\n评分后:")
        print(scored[['content_cleaned', 'rating', 'score']])

