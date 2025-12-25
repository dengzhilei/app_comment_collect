"""
交互式筛选包装脚本
处理交互式输入并调用筛选功能
"""
import sys
import subprocess
from pathlib import Path

# 添加当前目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.interactive.input import interactive_filter_input


def main():
    """主函数"""
    try:
        # 获取交互式输入
        game_name = interactive_filter_input()
        
        # 构建命令参数
        args = ['-m', 'src.filter']
        if game_name:
            args.append(game_name)
        
        # 调用筛选脚本
        print()
        if game_name:
            print("开始筛选: " + game_name)
        else:
            print("将自动查找最新的数据文件...")
        print()
        
        # 执行筛选
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

