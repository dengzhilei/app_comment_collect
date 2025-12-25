"""
交互式采集包装脚本
处理交互式输入并调用采集功能
"""
import sys
import subprocess
from pathlib import Path

# 添加当前目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.interactive.input import interactive_scrape_input


def main():
    """主函数"""
    try:
        # 获取交互式输入
        result = interactive_scrape_input()
        game_name = result[0]
        start_date = result[1]
        end_date = result[2]
        
        # 构建命令参数
        args = ['-m', 'src.scrape', game_name]
        if start_date and end_date:
            args.extend([start_date, end_date])
        
        # 调用采集脚本
        print()
        print("开始采集: " + game_name)
        if start_date and end_date:
            print(f"时间范围: {start_date} 至 {end_date}")
        else:
            print("时间范围: 最近一年 (默认)")
        print("这可能需要一些时间，请耐心等待...")
        print()
        
        # 执行采集
        exit_code = subprocess.call([sys.executable] + args)
        sys.exit(exit_code)
        
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

