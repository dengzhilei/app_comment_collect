import os
import sys
import shutil
import tempfile
from dotenv import load_dotenv

load_dotenv()

try:
    from google import genai
except ImportError:
    print("Error: The 'google-genai' library is not installed.")
    print("Please install it by running: pip install google-genai")
    sys.exit(1)

def upload_to_gemini(client, file_path):
    """
    通用上传方法，使用 tempfile 自动生成临时副本以避开 Windows 下的中文路径编码问题
    """
    if not os.path.exists(file_path):
        print(f"❌ 找不到文件: {file_path}")
        return None
    
    print(f"正在上传 {os.path.basename(file_path)} (文件较大时可能需要几秒到十几秒)...")
    temp_path = None
    try:
        # 提取原文件后缀名
        ext = os.path.splitext(file_path)[1]
        # 创建一个安全的临时文件路径
        fd, temp_path = tempfile.mkstemp(suffix=ext)
        os.close(fd)
        
        # 复制过去以便以纯英文名字上传
        shutil.copy2(file_path, temp_path)
        
        upload_file = client.files.upload(file=temp_path)
        print(f"✅ 上传成功！文件 URI: {upload_file.uri}")
        return upload_file
    except Exception as e:
        print(f"❌ 上传失败: {e}")
        return None
    finally:
        # 上传完及时清理，不留垃圾文件
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

def main():
    # 强制将终端输出设置为 utf-8，防止 Windows 终端不支持 emoji 而报错
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    api_key = os.environ.get("GEMINI_API_KEY")
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Failed to initialize the Gemini client: {e}")
        sys.exit(1)

    # 默认模型
    model_id = 'gemini-3.1-flash-lite-preview'
    print(f"Initialized Gemini Client. Using model: {model_id}")
    
    # 存放当前所有的附件对象
    uploaded_files = []
    
    print("\n" + "=" * 55)
    print("🤖 欢迎使用 Gemini 交互式工具")
    print("💡 使用说明:")
    print("  - 直接输入问题开始对话")
    print("  - 输入 '/upload <本地文件路径>' 上传支持的文档或图片作为上下文")
    print("    (例如: /upload C:\\test\\doc.pdf)")
    print("  - 输入 '/clear' 清除当前对话的全部附件")
    print("  - 输入 'quit' 退出程序")
    print("=" * 55)

    while True:
        try:
            prompt = input("\nYou: ").strip()
            if prompt.lower() in ['quit', 'exit']:
                break
            if not prompt:
                continue
                
            # 处理 '/upload' 命令
            if prompt.startswith('/upload'):
                parts = prompt.split(' ', 1)
                if len(parts) < 2:
                    print("用法错误: 请在 /upload 后面加上文件路径。")
                    continue
                
                # 去除可能的引号
                file_path = parts[1].strip().strip('"').strip("'")
                
                ext = os.path.splitext(file_path)[1].lower()
                if ext == '.docx':
                    print("⚠️ 警告: Gemini File API 当前无法原生解析 .docx 文件，建议另存为 .pdf 后再上传！")
                    
                file_obj = upload_to_gemini(client, file_path)
                if file_obj:
                    uploaded_files.append(file_obj)
                    print(f"ℹ️ 当前共有 {len(uploaded_files)} 个附件作为上下文。")
                continue
                
            # 处理 '/clear' 命令
            if prompt.startswith('/clear'):
                uploaded_files.clear()
                print("🗑️ 已清除所有上传的附件，接下来的对话不再带有之前的文档。")
                continue

            print("Gemini: ", end="", flush=True)
            
            # 组合包含的所有附件以及当前的提示词
            contents = uploaded_files + [prompt]
            
            from google.genai import types
            response = client.models.generate_content_stream(
                model=model_id,
                contents=contents,
                config=types.GenerateContentConfig(
                    tools=[{"google_search": {}}]
                )
            )
            
            for chunk in response:
                print(chunk.text, end="", flush=True)
            print()

        except EOFError:
            break
        except Exception as e:
            print(f"\n❌ 调用 API 时发生错误: {e}")

if __name__ == "__main__":
    main()
