#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用DeepSeek API翻译游戏评论文件
支持并发批量翻译，自动分批处理大量内容
"""

import os
import re
import asyncio
from pathlib import Path
from openai import AsyncOpenAI
from typing import List, Tuple

# API配置
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY') or 'sk-fa41a7bf6cd84d69a6903c7dd9b329ae'

# 翻译配置
MAX_TOKENS_PER_REQUEST = 25000  # 每次请求的最大token数（保守估计，留出安全余量）
TARGET_TOKENS_PER_BATCH = 5000  # 目标token数（降低以创建更多批次，提高并发）
MAX_CONCURRENT = 10  # 最大并发数（建议5-10个并发）
MAX_RETRIES = 3  # 最大重试次数
RETRY_DELAY = 2  # 重试延迟（秒）


def estimate_tokens(text: str) -> int:
    """
    估算文本的token数量
    英文：1 token ≈ 4个字符
    这里使用保守估算
    """
    return len(text) // 4


def create_batches(reviews: List[Tuple[str, str]]) -> List[List[Tuple[str, str]]]:
    """
    根据token数量动态创建批次
    优化策略：优先用满并发，创建足够多的批次，单批次内容量较小以提高响应速度
    """
    if not reviews:
        return []
    
    # 系统提示和用户提示的基础token数（估算）
    base_tokens = 200
    
    # 计算总token数和总评论数
    total_tokens = sum(estimate_tokens(review[1]) for review in reviews)
    total_reviews = len(reviews)
    
    # 优先用满并发：固定创建MAX_CONCURRENT个批次
    target_batch_count = MAX_CONCURRENT
    
    # 计算理想的单批次token数（确保能创建10个批次）
    ideal_batch_tokens = max(2000, total_tokens // target_batch_count)
    ideal_batch_tokens = min(ideal_batch_tokens, TARGET_TOKENS_PER_BATCH)
    
    batches = []
    current_batch = []
    current_tokens = 0
    
    for review in reviews:
        metadata, content = review
        content_tokens = estimate_tokens(content)
        
        # 检查是否超过硬限制
        if current_tokens + content_tokens + base_tokens > MAX_TOKENS_PER_REQUEST:
            if current_batch:
                batches.append(current_batch)
                current_batch = []
                current_tokens = 0
        
        # 优先策略：达到理想批次大小就创建新批次（用满并发）
        # 如果当前批次已经有内容，且加上这条会超过理想大小，就创建新批次
        if current_batch and current_tokens + content_tokens + base_tokens > ideal_batch_tokens:
            batches.append(current_batch)
            current_batch = []
            current_tokens = 0
        
        current_batch.append(review)
        current_tokens += content_tokens
    
    # 添加最后一批
    if current_batch:
        batches.append(current_batch)
    
    # 如果创建的批次不是10个，强制重新分配为正好10个批次
    if len(batches) != MAX_CONCURRENT and total_reviews >= MAX_CONCURRENT:
        # 重新分配，确保正好有MAX_CONCURRENT个批次
        reviews_per_batch = total_reviews // MAX_CONCURRENT
        remainder = total_reviews % MAX_CONCURRENT
        batches = []
        start_idx = 0
        for i in range(MAX_CONCURRENT):
            # 前remainder个批次多分配1条评论
            batch_size = reviews_per_batch + (1 if i < remainder else 0)
            batch = reviews[start_idx:start_idx + batch_size]
            if batch:
                batches.append(batch)
            start_idx += batch_size
    
    return batches


def parse_review_file(file_path):
    """
    解析评论文件，提取评论内容
    返回格式: [(metadata_line, review_content), ...]
    """
    reviews = []
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # 检查是否是评论元数据行
        if re.match(r'\[评论 \d+\]', line):
            metadata = line
            i += 1
            
            # 下一行应该是评论内容
            if i < len(lines) and lines[i].strip() and not lines[i].startswith('---'):
                review_content = lines[i].strip()
                reviews.append((metadata, review_content))
                i += 1
            else:
                i += 1
        else:
            i += 1
    
    return reviews


async def translate_text_batch(client: AsyncOpenAI, texts: List[str], batch_num: int = 1, semaphore: asyncio.Semaphore = None) -> List[str]:
    """
    异步批量翻译文本列表（支持并发和重试）
    client: OpenAI异步客户端
    texts: 要翻译的文本列表
    semaphore: 并发控制信号量
    """
    if not texts:
        return []
    
    # 构建翻译提示
    texts_list = []
    for i, text in enumerate(texts, 1):
        texts_list.append(f"{i}. {text}")
    
    texts_str = "\n\n".join(texts_list)
    
    prompt = f"""请将以下{len(texts)}条英文游戏评论逐条翻译成中文。要求：
1. 保持原文的语气和风格
2. 准确翻译，不要遗漏信息
3. 游戏术语保持原样或使用常见中文译名
4. 只返回翻译结果，每条一行，按顺序排列，不要添加编号或其他标记

英文评论：
{texts_str}

请直接返回{len(texts)}行中文翻译，每行一条："""
    
    # 重试机制
    for attempt in range(MAX_RETRIES):
        try:
            # 使用信号量控制并发
            if semaphore:
                async with semaphore:
                    print(f"  [批次 {batch_num}] 开始翻译，共 {len(texts)} 条评论...")
                    if attempt > 0:
                        print(f"    [批次 {batch_num}] 重试第 {attempt} 次...")
                    
                    response = await client.chat.completions.create(
                        model="deepseek-chat",
                        messages=[
                            {"role": "system", "content": "你是一个专业的游戏评论翻译助手，擅长将英文游戏评论准确翻译成中文。请严格按照要求格式返回翻译结果。"},
                            {"role": "user", "content": prompt}
                        ],
                        temperature=0.3,
                        stream=False
                    )
            else:
                print(f"  [批次 {batch_num}] 开始翻译，共 {len(texts)} 条评论...")
                if attempt > 0:
                    print(f"    [批次 {batch_num}] 重试第 {attempt} 次...")
                
                response = await client.chat.completions.create(
                    model="deepseek-chat",
                    messages=[
                        {"role": "system", "content": "你是一个专业的游戏评论翻译助手，擅长将英文游戏评论准确翻译成中文。请严格按照要求格式返回翻译结果。"},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                    stream=False
                )
            
            translated_text = response.choices[0].message.content.strip()
            
            # 解析翻译结果
            lines = [line.strip() for line in translated_text.split('\n') if line.strip()]
            
            # 过滤掉明显的标记行
            filtered_lines = []
            for line in lines:
                if not re.match(r'^[0-9]+[\.\)、]', line) and not re.match(r'^\[.*\]', line):
                    filtered_lines.append(line)
                elif len(line) > 20:
                    filtered_lines.append(line)
            
            # 如果过滤后数量不对，使用原始结果
            if len(filtered_lines) != len(texts):
                filtered_lines = lines[:len(texts)]
            
            # 确保数量匹配
            if len(filtered_lines) < len(texts):
                filtered_lines.extend(texts[len(filtered_lines):])
            elif len(filtered_lines) > len(texts):
                filtered_lines = filtered_lines[:len(texts)]
            
            print(f"  ✓ [批次 {batch_num}] 翻译完成，获得 {len(filtered_lines)} 条结果")
            return filtered_lines
            
        except Exception as e:
            error_msg = str(e)
            if attempt < MAX_RETRIES - 1:
                print(f"  ✗ [批次 {batch_num}] 翻译失败: {error_msg}")
                print(f"    [批次 {batch_num}] 等待 {RETRY_DELAY} 秒后重试...")
                await asyncio.sleep(RETRY_DELAY)
            else:
                print(f"  ✗ [批次 {batch_num}] 翻译失败（已重试 {MAX_RETRIES} 次）: {error_msg}")
                # 失败时返回原文
                return texts
    
    return texts  # 最终失败返回原文


async def translate_file_async(input_file, output_file):
    """
    异步翻译整个文件（并发版本）
    """
    print(f"\n{'='*60}")
    print(f"开始处理文件: {input_file.name if hasattr(input_file, 'name') else input_file}")
    print(f"输出文件: {output_file.name if hasattr(output_file, 'name') else output_file}")
    print(f"{'='*60}")
    
    # 解析文件
    reviews = parse_review_file(input_file)
    total_reviews = len(reviews)
    
    print(f"共找到 {total_reviews} 条评论需要翻译\n")
    
    if total_reviews == 0:
        print("未找到需要翻译的评论")
        return
    
    # 读取原文件的所有行（用于保持格式）
    with open(input_file, 'r', encoding='utf-8') as f:
        original_lines = f.readlines()
    
    # 创建翻译映射
    translation_map = {}
    
    # 动态创建批次（根据token数量）
    batches = create_batches(reviews)
    total_batches = len(batches)
    
    print(f"已创建 {total_batches} 个批次（优先用满并发，单批次内容量较小）")
    print(f"使用并发翻译，最大并发数: {MAX_CONCURRENT}")
    if total_batches > 0:
        avg_reviews = sum(len(batch) for batch in batches) // total_batches
        print(f"平均每批次约 {avg_reviews} 条评论\n")
    else:
        print()
    
    # 创建信号量控制并发
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    
    # 使用上下文管理器创建客户端
    async with AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com") as client:
        # 创建所有翻译任务
        tasks = []
        for batch_idx, batch_reviews in enumerate(batches, 1):
            review_texts = [review[1] for review in batch_reviews]
            task = translate_text_batch(client, review_texts, batch_num=batch_idx, semaphore=semaphore)
            tasks.append((batch_idx, batch_reviews, task))
        
        # 并发执行所有翻译任务
        print("开始并发翻译...\n")
        results = await asyncio.gather(*[task for _, _, task in tasks], return_exceptions=True)
    
    # 处理翻译结果
    for (batch_idx, batch_reviews, _), translations in zip(tasks, results):
        if isinstance(translations, Exception):
            print(f"  ✗ [批次 {batch_idx}] 发生异常: {translations}")
            # 失败时使用原文
            translations = [review[1] for review in batch_reviews]
        
        # 存储翻译结果
        for i, (metadata, original) in enumerate(batch_reviews):
            if i < len(translations):
                translation_map[original] = translations[i]
            else:
                translation_map[original] = original
    
    # 生成翻译后的文件
    print(f"\n正在生成翻译文件...")
    output_lines = []
    i = 0
    
    while i < len(original_lines):
        line = original_lines[i]
        
        # 检查是否是评论元数据行
        if re.match(r'\[评论 \d+\]', line.strip()):
            output_lines.append(line)  # 保留元数据行
            i += 1
            
            # 检查下一行是否是评论内容
            if i < len(original_lines):
                review_line = original_lines[i]
                if review_line.strip() and not review_line.startswith('---'):
                    original_content = review_line.strip()
                    # 替换为翻译内容
                    if original_content in translation_map:
                        translated = translation_map[original_content]
                        output_lines.append(translated + '\n')
                    else:
                        output_lines.append(review_line)  # 如果找不到翻译，保留原文
                    i += 1
                else:
                    output_lines.append(review_line)
                    i += 1
            else:
                i += 1
        else:
            output_lines.append(line)
            i += 1
    
    # 写入输出文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.writelines(output_lines)
    
    print(f"✓ 翻译完成！已保存到: {output_file}")
    print(f"  共翻译 {len(translation_map)} 条评论\n")
    
    # 确保所有异步操作完成
    await asyncio.sleep(0.1)  # 给一点时间让所有任务完成


def translate_file(input_file, output_file):
    """
    同步包装函数，调用异步翻译函数
    """
    # 使用 WindowsSelectorEventLoopPolicy 避免 Windows 上的 Proactor 问题（如果适用）
    if os.name == 'nt':
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        except:
            pass
            
    try:
        asyncio.run(translate_file_async(input_file, output_file))
    except Exception as e:
        print(f"执行过程中发生错误: {e}")


def main():
    """主函数"""
    # 使用脚本所在目录作为基准路径
    script_dir = Path(__file__).parent
    reports_dir = script_dir / "output/reports"
    
    # 获取所有txt文件（排除已翻译的文件）
    all_files = list(reports_dir.glob("*.txt"))
    txt_files = [f for f in all_files if "_中文" not in f.name]
    
    if not txt_files:
        print("未找到需要翻译的文件")
        return
    
    print("="*60)
    print("游戏评论翻译工具（并发版）")
    print("="*60)
    print(f"\n找到 {len(txt_files)} 个待翻译文件:\n")
    for i, f in enumerate(txt_files, 1):
        print(f"  {i}. {f.name}")
    
    # 用户选择文件
    while True:
        try:
            choice = input(f"\n请选择要翻译的文件 (1-{len(txt_files)})，或输入 q 退出: ").strip()
            
            if choice.lower() == 'q':
                print("已取消")
                return
            
            file_index = int(choice) - 1
            if 0 <= file_index < len(txt_files):
                selected_file = txt_files[file_index]
                break
            else:
                print(f"无效选择，请输入 1-{len(txt_files)} 之间的数字")
        except ValueError:
            print("请输入有效的数字")
        except KeyboardInterrupt:
            print("\n已取消")
            return
    
    # 生成输出文件名（保存到reports_chs目录）
    chs_reports_dir = script_dir / "output/reports_chs"
    chs_reports_dir.mkdir(exist_ok=True)
    output_file = chs_reports_dir / f"{selected_file.stem}_中文.txt"
    
    # 确认翻译
    print(f"\n{'='*60}")
    print(f"将翻译文件: {selected_file.name}")
    print(f"输出文件: {output_file.name}")
    print(f"{'='*60}")
    try:
        confirm = input("\n确认开始翻译? (Y/n，默认Y): ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print("\n已取消")
        return
    
    # 默认值为 'y'，空输入或 'y' 都表示确认
    if confirm and confirm != 'y':
        print("已取消")
        return
    
    # 开始翻译
    translate_file(selected_file, output_file)
    
    print("\n翻译完成！")


if __name__ == "__main__":
    main()
