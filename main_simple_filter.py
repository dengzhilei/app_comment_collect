"""
简单筛选脚本 - 粗筛有意义的评论并输出到文档
"""
import logging
import json
import re
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


def main(game_name: str = None):
    """主函数
    
    Args:
        game_name: 游戏名称，如果为None则自动检测最新的数据文件
    """
    logger.info("="*60)
    logger.info("评论粗筛工具")
    logger.info("="*60)
    
    # 查找已采集的数据
    data_dir = Path("data/raw")
    if not data_dir.exists():
        logger.error("数据目录不存在: data/raw")
        logger.info("请先运行数据采集")
        return
    
    # 如果指定了游戏名称，查找对应的文件（支持iOS和Android）
    if game_name:
        # 查找包含游戏名称的文件（iOS或Android），支持不同的时间范围
        # 替换空格、冒号等特殊字符为下划线，与文件名生成逻辑保持一致
        game_name_pattern = game_name.replace(' ', '_').replace(':', '_').replace('&', '_')
        patterns = [
            f"*{game_name_pattern}*android*.json",
            f"*{game_name_pattern}*ios*.json"
        ]
        files = []
        for pattern in patterns:
            files.extend(list(data_dir.glob(pattern)))
        
        if files:
            # 选择最新的文件（按修改时间）
            data_file = max(files, key=lambda p: p.stat().st_mtime)
            if len(files) > 1:
                logger.info(f"找到游戏 {game_name} 的 {len(files)} 个数据文件:")
                for f in sorted(files, key=lambda p: p.stat().st_mtime, reverse=True):
                    marker = " ← 将使用此文件" if f == data_file else ""
                    logger.info(f"  - {f.name}{marker}")
            else:
                logger.info(f"找到游戏 {game_name} 的数据文件: {data_file.name}")
            reviews = None  # 稍后从文件加载
        else:
            logger.error(f"未找到游戏 {game_name} 的数据文件")
            logger.info(f"查找模式: *{game_name_pattern}*android*.json 或 *{game_name_pattern}*ios*.json")
            logger.info("请先运行数据采集")
            return
    else:
        # 自动检测最新的数据文件（支持iOS和Android）
        json_files = list(data_dir.glob("*android*.json"))
        json_files.extend(list(data_dir.glob("*ios*.json")))
        
        if not json_files:
            logger.error("未找到数据文件（格式：*android*.json 或 *ios*.json）")
            logger.info("请先运行数据采集")
            return
        
        # 选择最新的文件
        data_file = max(json_files, key=lambda p: p.stat().st_mtime)
        logger.info(f"自动检测到最新数据文件: {data_file.name}")
        
        # 从文件名提取游戏名称
        file_name = data_file.stem
        if 'Animals' in file_name or 'animalkingdomraid' in file_name:
            game_name = "Animals & Coins"
        elif 'TopTycoon' in file_name or 'monopoly' in file_name.lower():
            game_name = "TopTycoon"
        elif 'Carnival' in file_name:
            game_name = "Carnival Tycoon"
        elif 'Fishing_Travel' in file_name or 'fishingtravel' in file_name.lower() or 'arkgame.ft' in file_name.lower():
            game_name = "Fishing Travel"
        elif 'Fishing_Master' in file_name or 'fishingmaster' in file_name.lower() or 'arkgame.fishingmaster' in file_name.lower():
            game_name = "Fishing Master"
        elif 'Fish_of_Fortune' in file_name or 'fishoffortune' in file_name.lower() or 'whalo.games.fishoffortune' in file_name.lower():
            game_name = "Fish of Fortune"
        elif 'Cash_Club' in file_name or 'cashclub' in file_name.lower() or 'cashparty' in file_name.lower() or 'unicornstudio.cashparty' in file_name.lower():
            game_name = "Cash Club"
        elif 'Sunday_City' in file_name or 'sundaycity' in file_name.lower() or 'adventure.party.real.life' in file_name.lower():
            game_name = "Sunday City: Life RolePlay"
        elif 'Fish' in file_name or 'Fortune' in file_name:
            game_name = "Fish of Fortune"  # 默认匹配
        else:
            # 尝试从文件名提取（取第一部分作为游戏名）
            parts = file_name.split('_')
            game_name = parts[0].replace('_', ' ') if parts else "Unknown"
        
        # 检测平台
        platform = "iOS" if 'ios' in file_name.lower() else "Android"
        logger.info(f"检测到游戏: {game_name} ({platform})")
        reviews = None  # 稍后从文件加载
        data_file = str(data_file)
    
    # 如果还没有加载数据，从文件加载
    if reviews is None:
        logger.info(f"\n加载数据: {data_file}")
        with open(data_file, 'r', encoding='utf-8') as f:
            reviews = json.load(f)
    
    logger.info(f"原始评论数: {len(reviews)} 条")
    
    # 从数据中获取游戏名称（如果数据中有）
    if reviews and 'game_name' in reviews[0]:
        game_name = reviews[0]['game_name']
        logger.info(f"游戏名称: {game_name}")
    
    # 步骤1: 数据清洗
    logger.info("\n步骤1: 数据清洗...")
    cleaner = DataCleaner()
    df = cleaner.clean_reviews(reviews)
    df = cleaner.process_dataframe(df)
    logger.info(f"清洗后: {len(df)} 条")
    
    # 步骤2: 第一步筛选 - 简单长度过滤
    logger.info("\n步骤2: 第一步筛选 - 长度过滤...")
    review_filter = ReviewFilter()
    df_filtered = review_filter.filter_by_length(df, min_length=30)
    logger.info(f"长度过滤后: {len(df_filtered)} 条")
    
    # 步骤3: 第二步筛选 - 权重评分
    logger.info("\n步骤3: 第二步筛选 - 权重评分...")
    df_scored = review_filter.score_reviews(df_filtered)
    
    # 步骤4: 选择前500条
    logger.info("\n步骤4: 选择前500条高价值评论...")
    max_reviews = min(500, len(df_scored))
    df_sorted = df_scored.nlargest(max_reviews, 'score')
    logger.info(f"最终保留: {len(df_sorted)} 条高价值评论")
    
    # 输出评分统计
    if len(df_sorted) > 0:
        logger.info(f"\n评分统计:")
        logger.info(f"  平均分: {df_sorted['score'].mean():.1f}")
        logger.info(f"  最高分: {df_sorted['score'].max():.1f}")
        logger.info(f"  最低分: {df_sorted['score'].min():.1f}")
        logger.info(f"  中位数: {df_sorted['score'].median():.1f}")
    
    # 步骤4: 生成输出文档
    logger.info("\n步骤4: 生成输出文档...")
    
    # 从输入文件名提取时间范围信息
    input_file_name = Path(data_file).stem  # 获取不带扩展名的文件名
    # 提取时间范围部分（如 202401-202411 或 early_202401-202411）
    time_range = ""
    if '_early_' in input_file_name:
        # 提取 early_202401-202411 这样的部分
        parts = input_file_name.split('_early_')
        if len(parts) > 1:
            time_range = f"early_{parts[1].split('_')[0]}"
    else:
        # 尝试提取时间范围（格式：202401-202512）
        time_match = re.search(r'(\d{6}-\d{6})', input_file_name)
        if time_match:
            time_range = time_match.group(1)
    
    # 使用游戏名称和时间范围生成输出文件名（只生成TXT格式）
    game_name_safe = game_name.replace(' ', '_').replace('&', '_').replace(':', '_')
    if time_range:
        output_file = f"output/reports/{game_name_safe}_{time_range}_精选评论_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    else:
        output_file = f"output/reports/{game_name_safe}_精选评论_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)
    
    # 生成TXT文档（纯文本，方便复制给AI）
    logger.info(f"正在生成报告...")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(generate_simple_text(df_sorted, game_name))
    
    logger.info(f"✓ 精选评论已保存: {output_file}")
    
    # 统计信息
    logger.info("\n" + "="*60)
    logger.info("筛选完成！")
    logger.info("="*60)
    logger.info(f"原始评论: {len(reviews)} 条")
    logger.info(f"清洗后: {len(df)} 条")
    logger.info(f"长度过滤后: {len(df_filtered)} 条")
    logger.info(f"最终精选: {len(df_sorted)} 条")
    logger.info(f"\n输出文件:")
    logger.info(f"  - 精选评论: {output_file}")
    logger.info("\n你可以将文件内容复制给AI进行进一步分析")
    logger.info("="*60)


def generate_simple_text(df: pd.DataFrame, game_name: str = "游戏") -> str:
    """生成简化版文本，方便复制给AI"""
    
    text = f"""我是一名游戏设计师，正在研究 {game_name} 这款游戏的商店评论区内容。这些评论来自2025年9-12月期间的玩家反馈。

请注意：我并不是这个app的制作商，我是在研究这款游戏，希望从玩家评论中：
1. 提取值得我借鉴的游戏设计思路和机制
2. 加深对玩家心理、需求和期望的理解
3. 了解玩家对这类游戏的兴奋点和痛点
4. 学习玩家喜欢或不喜欢的设计元素

我不太关心：
- 具体的Bug修复细节（除非能反映设计问题）
- 这个游戏特有的功能实现（除非有设计启发）
- 针对这个游戏的具体改进建议

我更关心：
- 玩家为什么会兴奋/沮丧？（情绪背后的设计原因）
- 哪些设计元素让玩家印象深刻？
- 玩家对游戏机制的期望和反馈模式
- 可以应用到我的游戏设计中的洞察

请帮我从这 {len(df)} 条精选评论中，提炼出对游戏设计师有价值的内容。

---

精选评论列表：

"""
    
    # 按评分排序
    df_sorted = df.sort_values('score', ascending=False)
    
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
        
        # 获取评分详情
        score = row.get('score', 'N/A')
        score_details = row.get('score_details', {})
        
        # 格式化评分详情
        detail_parts = []
        if isinstance(score_details, dict):
            for key, value in score_details.items():
                if key != 'length':  # 长度分单独显示
                    detail_parts.append(f"{key}: {value}")
        
        detail_str = f" | {', '.join(detail_parts)}" if detail_parts else ""
        
        text += f"\n[评论 {idx}] 评分: {rating}/5 | 综合分: {score}{detail_str} | 日期: {date}\n"
        text += f"{content}\n"
        text += "-" * 80 + "\n"
    
    text += f"\n\n总计: {len(df)} 条精选评论\n"
    
    return text


if __name__ == "__main__":
    import sys
    
    # 支持命令行参数指定游戏名称
    # 用法: python main_simple_filter.py TopTycoon
    game_name = None
    if len(sys.argv) > 1:
        game_name = sys.argv[1]
        logger.info(f"指定游戏: {game_name}")
    
    try:
        main(game_name=game_name)
    except KeyboardInterrupt:
        logger.info("\n\n用户中断程序")
    except Exception as e:
        logger.error(f"程序执行出错: {str(e)}", exc_info=True)

