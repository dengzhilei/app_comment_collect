import os
import base64
from playwright.sync_api import sync_playwright

# 配置
SAVE_DIR = "farm_avatars"
TARGET_SIZE = "512"  # 获取高清图的尺寸

if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR)

def run():
    with sync_playwright() as p:
        # 连接到已经手动打开的 Chrome (端口 9222)
        print("正在尝试连接到浏览器...")
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        context = browser.contexts[0]
        page = context.pages[0]  # 获取当前活动的 Discord 标签页
        
        print(f"成功连接！当前页面: {page.title()}")
        print("提示：请在浏览器中手动滚动成员列表。脚本将自动捕获头像。")

        # 用于去重，防止重复下载同一张图
        downloaded_hashes = set()

        def handle_response(response):
            url = response.url
            # 识别 Discord 头像 CDN 链接
            if "cdn.discordapp.com/avatars/" in url and response.status == 200:
                # 提取头像 ID (hash) 用于去重
                avatar_id = url.split('/')[-1].split('?')[0]
                
                if avatar_id in downloaded_hashes:
                    return
                
                downloaded_hashes.add(avatar_id)
                
                # 构造高清 URL (将 size 修改为 512)
                # 示例: .../avatars/xxx/yyy.webp?size=128 -> .../avatars/xxx/yyy.webp?size=512
                hd_url = url.split('?')[0] + f"?size={TARGET_SIZE}"
                
                print(f"检测到新头像，正在抓取高清版: {avatar_id}")

                try:
                    # 【核心技术流】：命令浏览器本身发起高清图请求，完美继承指纹和 Cookie
                    # 将图片转为 Base64 传回 Python
                    js_code = """
                    async (url) => {
                        const resp = await fetch(url);
                        const blob = await resp.blob();
                        return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    }
                    """
                    b64_data_uri = page.evaluate(js_code, hd_url)
                    
                    # 剥离 Base64 头部并保存
                    header, encoded = b64_data_uri.split(",", 1)
                    file_path = os.path.join(SAVE_DIR, f"{avatar_id}.png")
                    
                    with open(file_path, "wb") as f:
                        f.write(base64.b64decode(encoded))
                    
                    print(f"  [√] 已保存: {file_path}")
                except Exception as e:
                    print(f"  [X] 下载失败: {e}")

        # 绑定响应监听
        page.on("response", handle_response)

        # 保持运行 (你可以根据需要修改时间或手动 Ctrl+C 停止)
        page.wait_for_timeout(3600000) # 运行1小时

if __name__ == "__main__":
    run()