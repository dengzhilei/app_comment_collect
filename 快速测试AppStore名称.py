"""
快速测试App Store应用名称
直接访问App Store网页，验证应用名称
"""
import webbrowser
import yaml

def main():
    # 加载配置
    with open('config.yaml', 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    # 查找TopTycoon
    game_config = None
    for game in config['games']:
        if game['name'] == 'TopTycoon':
            game_config = game
            break
    
    if not game_config:
        print("未找到TopTycoon配置")
        return
    
    app_id = game_config.get('appstore_id', '')
    if not app_id:
        print("App Store ID未配置")
        return
    
    # App Store链接
    app_store_url = f"https://apps.apple.com/us/app/id{app_id}"
    
    print("="*60)
    print("App Store 应用信息验证")
    print("="*60)
    print()
    print(f"App ID: {app_id}")
    print(f"应用链接: {app_store_url}")
    print()
    print("请在浏览器中打开上述链接，查看应用的确切名称。")
    print("应用名称通常显示在页面顶部，应用图标旁边。")
    print()
    print("常见格式：")
    print("  - TopTycoon")
    print("  - Top Tycoon")
    print("  - Monopoly Dream Idle King")
    print("  - 或其他变体")
    print()
    
    # 询问是否打开浏览器
    try:
        response = input("是否在浏览器中打开此链接？(y/n): ").strip().lower()
        if response == 'y':
            webbrowser.open(app_store_url)
            print("\n已在浏览器中打开")
            print("\n找到应用名称后，请将其填入 config.yaml 的 appstore_name 字段")
    except:
        pass
    
    print()
    print("="*60)

if __name__ == "__main__":
    main()

