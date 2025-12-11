# 游戏商店评论分析系统

针对特定游戏在iOS和Google Play商店的评论进行采集和智能筛选。

## 项目概述

本项目旨在采集并筛选以下游戏的商店评论：
- Carnival Tycoon
- TopTycoon
- Animals & Coins
- Fish of Fortune

**核心功能**：
- ✅ **多平台支持**: 支持iOS App Store和Google Play Store
- ✅ **智能筛选**: 自动过滤无意义评论，保留有价值的反馈
- ✅ **价值排序**: 优先保留情绪化、具体的评论
- ✅ **简洁输出**: 生成可直接复制给AI分析的文档

## 设计理念

作为游戏设计师，需要的是：
- **有意义的反馈**：具体、情绪化、可操作的评论
- **高价值评论**：即使数量少，但包含具体问题/建议的评论
- **便于分析**：输出格式简洁，可直接复制给AI进行深度分析

## 环境要求

- Python 3.8+
- Windows/Linux/macOS

## 安装步骤

### 1. 安装依赖

**方式1：使用批处理文件（推荐，Windows）**
- 双击运行 `安装依赖_智能版.bat`

**方式2：命令行安装**
```bash
pip install -r requirements.txt
```

### 2. 配置游戏ID

编辑 `config.yaml` 文件，填入各游戏在App Store和Google Play的ID：

```yaml
games:
  - name: "Animals & Coins"
    appstore_id: ""  # 需要查找
    playstore_id: "com.innplaylabs.animalkingdomraid"  # 需要查找
    platforms: ["ios", "android"]
```

**如何查找游戏ID：**
- **App Store**: 在iTunes或App Store中搜索游戏，从URL中获取ID
- **Google Play**: 在Google Play中搜索游戏，从URL中获取包名（如 com.example.game）

## 使用方法

### 步骤1：数据采集

**方式1：使用批处理文件（推荐，Windows）**
- 双击运行 `运行测试.bat` - 测试单个游戏的数据采集

**方式2：命令行运行**
```bash
python3 test_scraper.py
```

**完整采集**（使用配置文件）：
```bash
python3 -m src.scraper.main_scraper
```

### 步骤2：智能筛选

**方式1：使用批处理文件（推荐，Windows）**
- 双击运行 `运行粗筛.bat`

**方式2：命令行运行**
```bash
python3 main_simple_filter.py
```

程序会：
1. 加载已采集的数据
2. 智能筛选有意义的评论（过滤"fun"、"good"等无意义评论）
3. 按价值排序（极端评分、长评论、包含问题描述的优先）
4. 生成两个文件：
   - **详细版**（Markdown格式）- 包含完整统计和格式化内容
   - **简化版**（TXT格式）- 纯文本，可直接复制给AI分析

### 步骤3：AI分析

将简化版TXT文件的内容复制给AI（如ChatGPT、Claude等），让AI进行深度分析和总结。

## 项目结构

```
商店评论区分析/
├── README.md                 # 项目说明
├── requirements.txt          # Python依赖
├── config.yaml               # 配置文件
├── main_simple_filter.py     # 评论筛选主程序
├── test_scraper.py           # 测试采集脚本
├── src/
│   ├── scraper/             # 数据采集模块
│   │   ├── appstore_scraper.py
│   │   ├── playstore_scraper.py
│   │   └── main_scraper.py
│   ├── processor/           # 数据处理模块
│   │   ├── data_cleaner.py
│   │   └── text_preprocessor.py
│   └── analyzer/            # 分析模块
│       └── review_filter.py # 评论筛选器
├── data/
│   ├── raw/                 # 原始数据
│   ├── processed/           # 处理后数据
│   └── analysis/            # 分析结果
└── output/                  # 输出报告
    └── reports/             # 筛选后的评论文档
```

## 筛选标准

### 保留的评论
- ✅ 长度 ≥ 30字符
- ✅ 包含具体内容（游戏相关关键词）
- ✅ 包含问题描述或建议
- ✅ 情绪化表达（极端评分优先）

### 过滤的评论
- ❌ 过短评论（<30字符）
- ❌ 简单词汇（"fun", "good", "5 stars"）
- ❌ 无具体内容的评论

## 输出示例

简化版格式（可直接复制给AI）：
```
[评论 1] 评分: 1/5 | 日期: 2025-10-15
The coin system is broken. I spent $10 and got nothing. This needs to be fixed immediately.
--------------------------------------------------------------------------------

[评论 2] 评分: 5/5 | 日期: 2025-11-20
Great game! But we need more levels. The current content gets repetitive after a while.
--------------------------------------------------------------------------------
```

## 配置说明

主要配置项在 `config.yaml` 中：

- **games**: 游戏列表和ID配置
- **scraper**: 采集配置（时间范围、数量限制、地区等）
- **regions**: 地区配置（语言、国家代码）

## 注意事项

1. **数据采集限制**: 
   - App Store和Google Play可能有反爬虫机制
   - 建议设置合理的请求间隔（`delay_between_requests`）
   - 如果采集失败，可以手动补充数据

2. **游戏ID查找**:
   - 需要手动查找每个游戏在App Store和Google Play的准确ID
   - 确保ID正确，否则无法采集数据

3. **数据使用**:
   - 请遵守各平台的服务条款
   - 数据仅用于分析目的

## 常见问题

### Q: 采集不到数据怎么办？
A: 
1. 检查游戏ID是否正确
2. 检查网络连接
3. 尝试增加请求延迟时间
4. 检查是否有反爬虫限制

### Q: 筛选后评论太少？
A: 
- 可以降低 `min_length` 参数（在 `main_simple_filter.py` 中）
- 可以调整关键词列表（在 `review_filter.py` 中）

### Q: 如何修改筛选标准？
A: 
- 编辑 `src/analyzer/review_filter.py`
- 修改 `meaningless_patterns` 和 `meaningful_keywords`

## 许可证

本项目仅供学习和研究使用。
