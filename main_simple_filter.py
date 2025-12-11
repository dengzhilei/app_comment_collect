"""
简单筛选脚本 - 粗筛有意义的评论并输出到文档
"""
import logging
import json
import pandas as pd
from pathlib import Path
from datetime import datetime

from src.processor.data_cleaner import DataCleaner
from src.analyzer.review_filter import ReviewFilter

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('filter.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def main():
    """主函数"""
    logger.info("="*60)
    logger.info("评论粗筛工具")
    logger.info("="*60)
    
    # 查找已采集的数据
    data_file = f"data/raw/Animals_&_Coins_android_美国_202509-202512.json"
    if not Path(data_file).exists():
        logger.error(f"未找到数据文件: {data_file}")
        logger.info("请先运行数据采集")
        return
    
    logger.info(f"加载数据: {data_file}")
    with open(data_file, 'r', encoding='utf-8') as f:
        reviews = json.load(f)
    
    logger.info(f"原始评论数: {len(reviews)} 条")
    
    # 步骤1: 数据清洗
    logger.info("\n步骤1: 数据清洗...")
    cleaner = DataCleaner()
    df = cleaner.clean_reviews(reviews)
    df = cleaner.process_dataframe(df)
    logger.info(f"清洗后: {len(df)} 条")
    
    # 步骤2: 智能筛选
    logger.info("\n步骤2: 智能筛选有意义的评论...")
    review_filter = ReviewFilter()
    df_filtered = review_filter.filter_meaningful_reviews(df, min_length=30)  # 提高最小长度要求
    logger.info(f"筛选后: {len(df_filtered)} 条")
    
    # 步骤3: 进一步筛选 - 按评分和长度排序，优先保留有价值的评论
    logger.info("\n步骤3: 按价值排序...")
    
    # 计算价值分数：极端评分 + 长评论 + 包含问题描述
    df_filtered = df_filtered.copy()
    df_filtered['value_score'] = (
        abs(df_filtered['rating'] - 3) * 2 +  # 极端评分（1星或5星）更有价值
        (df_filtered['content_cleaned'].str.len() / 50) +  # 长评论更有价值
        df_filtered['content_cleaned'].str.lower().str.contains(
            r'(bug|problem|issue|fix|need|should|improve|add|remove|change|broken|crash|error)',
            regex=False, na=False  # 修复警告：明确指定regex=False
        ).astype(int) * 3  # 包含问题/建议关键词的更有价值
    )
    
    # 排序并选择Top评论
    max_reviews = min(500, len(df_filtered))  # 最多保留500条
    df_sorted = df_filtered.nlargest(max_reviews, 'value_score')
    logger.info(f"最终保留: {len(df_sorted)} 条高价值评论")
    
    # 步骤4: 生成输出文档
    logger.info("\n步骤4: 生成输出文档...")
    
    output_file = f"output/reports/Animals_&_Coins_精选评论_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)
    
    # 生成Markdown文档
    content = generate_filtered_report(df_sorted, len(reviews), len(df), len(df_filtered))
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    logger.info(f"✓ 文档已保存: {output_file}")
    
    # 同时生成简化版（纯文本，方便复制给AI）
    simple_file = output_file.replace('.md', '_简化版.txt')
    with open(simple_file, 'w', encoding='utf-8') as f:
        f.write(generate_simple_text(df_sorted))
    
    logger.info(f"✓ 简化版已保存: {simple_file}")
    
    # 统计信息
    logger.info("\n" + "="*60)
    logger.info("筛选完成！")
    logger.info("="*60)
    logger.info(f"原始评论: {len(reviews)} 条")
    logger.info(f"清洗后: {len(df)} 条")
    logger.info(f"筛选后: {len(df_filtered)} 条")
    logger.info(f"最终精选: {len(df_sorted)} 条")
    logger.info(f"\n输出文件:")
    logger.info(f"  - 详细版: {output_file}")
    logger.info(f"  - 简化版: {simple_file}")
    logger.info("\n你可以将简化版内容复制给AI进行进一步分析")
    logger.info("="*60)


def generate_filtered_report(df: pd.DataFrame, original_count: int, cleaned_count: int, filtered_count: int) -> str:
    """生成筛选后的报告"""
    
    report = f"""# Animals & Coins 精选评论

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 筛选统计

- **原始评论数**: {original_count:,} 条
- **清洗后**: {cleaned_count:,} 条
- **智能筛选后**: {filtered_count:,} 条
- **最终精选**: {len(df):,} 条

## 筛选标准

1. **长度要求**: 至少30个字符
2. **排除无意义评论**: 过滤"fun"、"good"等简单词汇
3. **包含具体内容**: 必须包含游戏相关关键词
4. **价值排序**: 优先保留极端评分、长评论、包含问题/建议的评论

---

## 精选评论列表

"""
    
    # 按评分分组显示
    for rating in sorted(df['rating'].unique(), reverse=True):
        df_rating = df[df['rating'] == rating]
        if len(df_rating) == 0:
            continue
        
        report += f"\n### {rating} 星评论 ({len(df_rating)} 条)\n\n"
        
        for idx, (_, row) in enumerate(df_rating.iterrows(), 1):
            report += f"#### 评论 {idx}\n\n"
            # 处理日期：如果是Timestamp对象，先转换为字符串
            date_value = row.get('date', 'N/A')
            if pd.notna(date_value) and date_value != 'N/A':
                if isinstance(date_value, pd.Timestamp):
                    date_str = date_value.strftime('%Y-%m-%d')
                elif isinstance(date_value, str):
                    date_str = date_value[:10] if len(date_value) >= 10 else date_value
                else:
                    date_str = str(date_value)[:10]
            else:
                date_str = 'N/A'
            
            report += f"**日期**: {date_str}\n"
            report += f"**价值分数**: {row.get('value_score', 0):.2f}\n\n"
            report += f"**评论内容**:\n```\n{row.get('content_cleaned', row.get('content', ''))}\n```\n\n"
            report += "---\n\n"
    
    return report


def generate_simple_text(df: pd.DataFrame) -> str:
    """生成简化版文本，方便复制给AI"""
    
    text = f"""以下是从 {len(df)} 条精选评论中提取的有价值的玩家反馈。

请作为游戏设计师，分析这些评论并提取：
1. 最重要的设计问题（Top 5）
2. 玩家最关心的功能需求
3. 需要优先修复的Bug
4. 游戏平衡性问题
5. 具体的改进建议

---

精选评论列表：

"""
    
    # 按价值分数排序
    df_sorted = df.sort_values('value_score', ascending=False)
    
    for idx, (_, row) in enumerate(df_sorted.iterrows(), 1):
        rating = row.get('rating', 'N/A')
        content = row.get('content_cleaned', row.get('content', ''))
        
        # 处理日期：如果是Timestamp对象，先转换为字符串
        date_value = row.get('date', 'N/A')
        if pd.notna(date_value) and date_value != 'N/A':
            if isinstance(date_value, pd.Timestamp):
                date = date_value.strftime('%Y-%m-%d')
            elif isinstance(date_value, str):
                date = date_value[:10] if len(date_value) >= 10 else date_value
            else:
                date = str(date_value)[:10]
        else:
            date = 'N/A'
        
        text += f"\n[评论 {idx}] 评分: {rating}/5 | 日期: {date}\n"
        text += f"{content}\n"
        text += "-" * 80 + "\n"
    
    text += f"\n\n总计: {len(df)} 条精选评论\n"
    
    return text


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n\n用户中断程序")
    except Exception as e:
        logger.error(f"程序执行出错: {str(e)}", exc_info=True)

