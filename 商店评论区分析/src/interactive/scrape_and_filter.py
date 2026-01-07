"""
合并采集和筛选的交互式脚本
采集完成后自动进行筛选，无需确认
"""
import sys
import subprocess
from pathlib import Path

# 添加当前目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.interactive.input import interactive_scrape_input


def run_scrape(game_name, start_date=None, end_date=None):
    """执行采集任务"""
    print()
    print("="*60)
    print("步骤1: 开始采集评论")
    print("="*60)
    print(f"开始采集: {game_name}")
    if start_date and end_date:
        print(f"时间范围: {start_date} 至 {end_date}")
    else:
        print("时间范围: 最近一年 (默认)")
    print("这可能需要一些时间，请耐心等待...")
    print()
    
    # 构建采集命令参数
    scrape_args = ['-m', 'src.scrape', game_name]
    if start_date and end_date:
        scrape_args.extend([start_date, end_date])
    
    # 执行采集
    exit_code = subprocess.call([sys.executable] + scrape_args)
    return exit_code


def run_filter(game_name):
    """执行筛选任务"""
    print()
    print("="*60)
    print("步骤2: 开始筛选评论")
    print("="*60)
    print(f"开始筛选: {game_name}")
    print()
    
    # 构建筛选命令参数
    filter_args = ['-m', 'src.filter', game_name]
    
    # 执行筛选
    exit_code = subprocess.call([sys.executable] + filter_args)
    return exit_code


def main():
    """主函数"""
    try:
        # 获取交互式输入
        result = interactive_scrape_input()
        game_name = result[0]
        start_date = result[1]
        end_date = result[2]
        
        # 步骤1: 执行采集
        scrape_exit_code = run_scrape(game_name, start_date, end_date)
        
        if scrape_exit_code != 0:
            print("\n" + "="*60)
            print("采集失败，程序退出")
            print("="*60)
            sys.exit(scrape_exit_code)
        
        # 步骤2: 自动执行筛选
        filter_exit_code = run_filter(game_name)
        
        if filter_exit_code != 0:
            print("\n" + "="*60)
            print("筛选失败")
            print("="*60)
            sys.exit(filter_exit_code)
        
        # 完成提示
        print()
        print("="*60)
        print("全部完成！")
        print("="*60)
        print()
        print("查看结果:")
        print("  精选评论: output\\reports\\ (TXT格式,可直接复制给AI)")
        print()
        
        sys.exit(0)
        
    except KeyboardInterrupt:
        print("\n\n用户中断程序")
        sys.exit(1)
    except SystemExit:
        # 重新抛出系统退出，保持退出码
        raise
    except Exception as e:
        print(f"错误: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

