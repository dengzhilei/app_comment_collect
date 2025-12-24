# Playwright方法说明

## 概述

由于 `app-store-scraper` 库遇到反爬虫机制问题，我们提供了一个使用 **Playwright** 的替代方案。

Playwright 会模拟真实浏览器访问 App Store，绕过大部分反爬虫机制。

## 安装步骤

### 1. 安装 Playwright

```bash
pip install playwright
```

### 2. 安装浏览器驱动

```bash
playwright install chromium
```

或者运行：
```bash
运行Playwright测试.bat
```
（会自动检查并安装依赖）

## 使用方法

### 测试采集

双击运行：**`运行Playwright测试.bat`**

或命令行：
```bash
python test_ios_playwright.py
```

### 完整采集

修改 `采集TopTycoon_iOS.py`，将导入改为：
```python
from src.scraper.appstore_scraper_playwright import AppStoreScraperPlaywright
```

## 特点

### 优点
- ✅ 模拟真实浏览器，绕过反爬虫机制
- ✅ 可以看到采集过程（headless=False时）
- ✅ 更稳定可靠

### 缺点
- ⚠️ 需要安装浏览器驱动（约200MB）
- ⚠️ 运行速度较慢（需要等待页面加载）
- ⚠️ 会打开浏览器窗口（可以设置headless=True隐藏）

## 配置选项

在创建采集器时，可以设置：

```python
scraper = AppStoreScraperPlaywright(
    delay=3.0,        # 请求间隔（秒）
    retry_times=3,    # 重试次数
    headless=False    # False=显示浏览器窗口，True=无头模式
)
```

## 故障排除

### 问题1：找不到评论元素

如果采集不到评论，可能是App Store页面结构变化了。需要：
1. 设置 `headless=False` 查看浏览器窗口
2. 检查页面是否正确加载
3. 可能需要更新选择器

### 问题2：浏览器驱动未安装

运行：
```bash
playwright install chromium
```

### 问题3：采集速度慢

这是正常的，因为需要等待页面加载。可以：
- 减少 `max_reviews` 数量
- 增加 `delay` 时间（避免被限制）

## 与app-store-scraper的对比

| 特性 | app-store-scraper | Playwright |
|------|-------------------|------------|
| 速度 | 快 | 较慢 |
| 稳定性 | 受反爬虫影响 | 更稳定 |
| 安装 | 简单 | 需要浏览器驱动 |
| 调试 | 困难 | 可以看到过程 |

## 建议

如果 `app-store-scraper` 持续失败，建议使用 Playwright 方法。

