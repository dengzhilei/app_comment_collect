"""
检查依赖是否安装
"""
import sys

print("=" * 60)
print("检查Python依赖...")
print("=" * 60)
print(f"Python版本: {sys.version}")
print()

missing = []

# 检查关键依赖
dependencies = {
    'google_play_scraper': 'google-play-scraper',
    'yaml': 'pyyaml',
    'pandas': 'pandas',
    'jieba': 'jieba',
    'snownlp': 'snownlp',
    'textblob': 'textblob',
    'matplotlib': 'matplotlib',
}

for module, package in dependencies.items():
    try:
        __import__(module)
        print(f"✓ {package} - 已安装")
    except ImportError:
        print(f"✗ {package} - 未安装")
        missing.append(package)

print()
if missing:
    print("=" * 60)
    print("缺少以下依赖，请运行以下命令安装：")
    print("=" * 60)
    print(f"pip install {' '.join(missing)}")
    print()
    print("或者安装所有依赖：")
    print("pip install -r requirements.txt")
else:
    print("=" * 60)
    print("✓ 所有依赖都已安装！")
    print("=" * 60)

