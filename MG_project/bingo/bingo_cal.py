"""
5x5的bingo 格（中间也可以填，不是默认填上的），
随机出球填上对应格，
模拟x次，每次bingo后结束重来
统计最终 1 bingo、2bingo、3bingo、4bingo 分别每种下，对应的盘面上总球数的 次数分布
-注：用多进程加速模拟
"""

import random
import multiprocessing
from collections import defaultdict
import os
import time

GRID_SIZE = 5
TOTAL_CELLS = GRID_SIZE * GRID_SIZE
MAX_BINGO_TRACK = 4


def build_lines():
    lines = []
    for r in range(GRID_SIZE):
        lines.append(tuple(r * GRID_SIZE + c for c in range(GRID_SIZE)))
    for c in range(GRID_SIZE):
        lines.append(tuple(r * GRID_SIZE + c for r in range(GRID_SIZE)))
    lines.append(tuple(i * GRID_SIZE + i for i in range(GRID_SIZE)))
    lines.append(tuple(i * GRID_SIZE + (GRID_SIZE - 1 - i) for i in range(GRID_SIZE)))
    return lines


LINES = build_lines()

# cell_to_lines[cell] = 该格子参与的 line 索引列表
CELL_TO_LINES = [[] for _ in range(TOTAL_CELLS)]
for li, line in enumerate(LINES):
    for cell in line:
        CELL_TO_LINES[cell].append(li)


def simulate_one(seed):
    """单次模拟：随机出球填格，一旦出现 bingo 立刻停止，返回 (同时完成的线数, 已出球数)。"""
    rng = random.Random(seed)
    balls = list(range(TOTAL_CELLS))
    rng.shuffle(balls)

    line_filled = [0] * len(LINES)

    for drawn, ball in enumerate(balls, 1):
        new_bingos = 0
        for li in CELL_TO_LINES[ball]:
            line_filled[li] += 1
            if line_filled[li] == GRID_SIZE:
                new_bingos += 1
        if new_bingos > 0:
            return (new_bingos, drawn)

    return (0, TOTAL_CELLS)


def run_batch(args):
    batch_size, base_seed = args
    results = []
    for i in range(batch_size):
        results.append(simulate_one(base_seed + i))
    return results


def main():
    raw = input("模拟次数（默认 1000000）: ").strip()
    num_simulations = int(raw) if raw else 1_000_000

    num_workers = max(1, (os.cpu_count() or 4) - 1)
    batch_per_worker = num_simulations // num_workers
    remainder = num_simulations % num_workers

    tasks = []
    seed = 0
    for w in range(num_workers):
        size = batch_per_worker + (1 if w < remainder else 0)
        tasks.append((size, seed))
        seed += size

    print(f"\n=== Bingo 5x5 模拟器 ===")
    print(f"格子: {GRID_SIZE}x{GRID_SIZE}（中间不预填）")
    print(f"Bingo 线: {len(LINES)} 条（{GRID_SIZE}行 + {GRID_SIZE}列 + 2对角）")
    print(f"模拟次数: {num_simulations:,}")
    print(f"进程数: {num_workers}")
    print("模拟中...\n")

    distributions = {n: defaultdict(int) for n in range(1, MAX_BINGO_TRACK + 1)}
    bingo_type_count = defaultdict(int)
    t0 = time.time()

    with multiprocessing.Pool(num_workers) as pool:
        for batch_results in pool.imap_unordered(run_batch, tasks):
            for (bingo_n, balls_drawn) in batch_results:
                bingo_type_count[bingo_n] += 1
                if 1 <= bingo_n <= MAX_BINGO_TRACK:
                    distributions[bingo_n][balls_drawn] += 1

    elapsed = time.time() - t0
    print(f"完成! 耗时 {elapsed:.2f}s ({num_simulations / elapsed:,.0f} 次/s)\n")

    print(f"{'=' * 64}")
    print(f"  停止时同时完成的 Bingo 线数统计")
    print(f"{'=' * 64}")
    for n in sorted(bingo_type_count.keys()):
        cnt = bingo_type_count[n]
        pct = cnt / num_simulations * 100
        print(f"  {n} Bingo: {cnt:>10,} 次  ({pct:.3f}%)")
    print()

    for bingo_n in range(1, MAX_BINGO_TRACK + 1):
        dist = distributions[bingo_n]
        total = sum(dist.values())
        if total == 0:
            print(f"{'=' * 64}")
            print(f"  {bingo_n} Bingo — 未出现")
            print()
            continue

        print(f"{'=' * 64}")
        print(f"  {bingo_n} Bingo 时盘面总球数分布（共 {total:,} 次）")
        print(f"{'=' * 64}")
        print(f"  {'球数':>4}  {'次数':>10}  {'占比':>8}  {'累计':>8}  分布")
        print(f"  {'─' * 4:>4}  {'─' * 8:>10}  {'─' * 6:>8}  {'─' * 6:>8}  ─────")

        cumulative = 0
        for balls in sorted(dist.keys()):
            count = dist[balls]
            cumulative += count
            pct = count / total * 100
            cum_pct = cumulative / total * 100
            bar_len = max(0, int(pct * 1.5))
            print(f"  {balls:>4}  {count:>10,}  {pct:>7.2f}%  {cum_pct:>7.2f}%  {'█' * bar_len}")

        total_balls = sum(k * v for k, v in dist.items())
        avg = total_balls / total
        sorted_keys = sorted(dist.keys())
        mid = total // 2
        cum = 0
        median = sorted_keys[0]
        for k in sorted_keys:
            cum += dist[k]
            if cum >= mid:
                median = k
                break
        print(f"\n  平均: {avg:.2f}  中位数: {median}  "
              f"最小: {sorted_keys[0]}  最大: {sorted_keys[-1]}")
        print()


if __name__ == '__main__':
    main()
