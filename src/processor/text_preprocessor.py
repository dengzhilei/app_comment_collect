"""
文本预处理模块
"""
import re
import logging
from typing import List, Set
import jieba
import jieba.analyse

logger = logging.getLogger(__name__)


class TextPreprocessor:
    """文本预处理器"""
    
    def __init__(self):
        """初始化预处理器"""
        # 初始化jieba
        jieba.initialize()
        
        # 游戏相关停用词
        self.stopwords = self._load_stopwords()
    
    def _load_stopwords(self) -> Set[str]:
        """加载停用词"""
        # 基础停用词
        stopwords = {
            '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'
        }
        
        # 可以添加更多停用词
        return stopwords
    
    def detect_language(self, text: str) -> str:
        """
        检测文本语言
        
        Args:
            text: 文本内容
        
        Returns:
            'zh' 或 'en'
        """
        if not text:
            return 'zh'
        
        # 简单的中文检测：如果包含中文字符，认为是中文
        chinese_pattern = re.compile(r'[\u4e00-\u9fa5]')
        if chinese_pattern.search(text):
            return 'zh'
        else:
            return 'en'
    
    def segment_chinese(self, text: str) -> List[str]:
        """
        中文分词
        
        Args:
            text: 中文文本
        
        Returns:
            分词结果列表
        """
        if not text:
            return []
        
        # 使用jieba分词
        words = jieba.cut(text, cut_all=False)
        
        # 过滤停用词和单字符
        words = [w for w in words if w not in self.stopwords and len(w.strip()) > 1]
        
        return words
    
    def segment_english(self, text: str) -> List[str]:
        """
        英文分词（简单版本）
        
        Args:
            text: 英文文本
        
        Returns:
            分词结果列表
        """
        if not text:
            return []
        
        # 转小写并分词
        words = re.findall(r'\b[a-z]+\b', text.lower())
        
        # 过滤短词
        words = [w for w in words if len(w) > 2]
        
        return words
    
    def segment(self, text: str) -> List[str]:
        """
        自动检测语言并分词
        
        Args:
            text: 文本内容
        
        Returns:
            分词结果列表
        """
        lang = self.detect_language(text)
        
        if lang == 'zh':
            return self.segment_chinese(text)
        else:
            return self.segment_english(text)
    
    def extract_keywords(self, text: str, top_k: int = 10) -> List[str]:
        """
        提取关键词
        
        Args:
            text: 文本内容
            top_k: 返回前k个关键词
        
        Returns:
            关键词列表
        """
        if not text:
            return []
        
        lang = self.detect_language(text)
        
        if lang == 'zh':
            # 使用jieba提取关键词
            keywords = jieba.analyse.extract_tags(text, topK=top_k, withWeight=False)
        else:
            # 英文关键词提取（简单版本）
            words = self.segment_english(text)
            from collections import Counter
            word_freq = Counter(words)
            keywords = [word for word, _ in word_freq.most_common(top_k)]
        
        return keywords


if __name__ == "__main__":
    # 测试代码
    logging.basicConfig(level=logging.INFO)
    preprocessor = TextPreprocessor()
    
    # 测试中文
    chinese_text = "这个游戏非常好玩，画面精美，玩法有趣！"
    print(f"中文分词: {preprocessor.segment_chinese(chinese_text)}")
    print(f"中文关键词: {preprocessor.extract_keywords(chinese_text)}")
    
    # 测试英文
    english_text = "This game is amazing! Great graphics and fun gameplay."
    print(f"英文分词: {preprocessor.segment_english(english_text)}")
    print(f"英文关键词: {preprocessor.extract_keywords(english_text)}")

