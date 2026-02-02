# -*- coding: utf-8 -*-
import os

# 配置
AVATAR_DIR = os.path.join(os.path.dirname(__file__), "farm_avatars")
PREFIX = "avatar_"  # 前缀
START_NUM = 1       # 起始编号

def rename_avatars():
    if not os.path.exists(AVATAR_DIR):
        print(f"目录不存在: {AVATAR_DIR}")
        return
    
    # 获取所有文件（排除目录）
    files = [f for f in os.listdir(AVATAR_DIR) if os.path.isfile(os.path.join(AVATAR_DIR, f))]
    
    if not files:
        print("目录为空，没有文件需要重命名")
        return
    
    # 按修改时间排序（可选，保持一致性）
    files.sort(key=lambda x: os.path.getmtime(os.path.join(AVATAR_DIR, x)))
    
    print(f"找到 {len(files)} 个文件，开始重命名...\n")
    
    # 先收集重命名计划，避免命名冲突
    rename_plan = []
    for i, old_name in enumerate(files, start=START_NUM):
        # 保留原扩展名
        ext = os.path.splitext(old_name)[1]
        new_name = f"{PREFIX}{i}{ext}"
        rename_plan.append((old_name, new_name))
    
    # 执行重命名（先改成临时名避免冲突）
    temp_names = []
    for old_name, _ in rename_plan:
        old_path = os.path.join(AVATAR_DIR, old_name)
        temp_name = f"__temp__{old_name}"
        temp_path = os.path.join(AVATAR_DIR, temp_name)
        os.rename(old_path, temp_path)
        temp_names.append(temp_name)
    
    # 最终重命名
    renamed_count = 0
    for temp_name, (_, new_name) in zip(temp_names, rename_plan):
        temp_path = os.path.join(AVATAR_DIR, temp_name)
        new_path = os.path.join(AVATAR_DIR, new_name)
        os.rename(temp_path, new_path)
        renamed_count += 1
        print(f"  {renamed_count}. {new_name}")
    
    print(f"\n✓ 完成！共重命名 {renamed_count} 个文件")

if __name__ == "__main__":
    rename_avatars()
