# 游戏商店评论采集与筛选工具

一个简单易用的工具，用于采集 Google Play 商店的游戏评论，并智能筛选出有价值的评论供游戏设计师分析。

## 快速开始

### 1. 安装依赖

双击运行：`安装依赖.bat`

或手动安装：
```bash
pip install -r requirements.txt
```

### 2. 配置游戏

编辑 `config.yaml`，填入游戏的 Google Play ID：

```yaml
games:
  - name: "TopTycoon"
    playstore_id: "com.monopoly.dream.idle.king"
    platforms: ["android"]
```

### 3. 采集评论

**方法一：使用批处理文件（推荐，交互式）**
```bash
# 双击运行 运行采集.bat，然后按提示操作
运行采集.bat
```

运行后会显示：
1. 游戏列表菜单，选择数字（1-9）
2. 时间范围选择：
   - 选择 1：使用默认时间范围（最近一年）
   - 选择 2：自定义时间范围，输入开始日期和结束日期

**方法二：命令行参数（高级用法）**
```bash
运行采集.bat "游戏名称" [开始日期] [结束日期]
```

**方法三：直接运行Python脚本**
```bash
python 采集评论.py "游戏名称" [开始日期] [结束日期]
```

**示例：**
```bash
# 交互式（推荐）
运行采集.bat
# 然后选择游戏和时间范围

# 命令行方式
运行采集.bat "TopTycoon" 2025-09-01 2025-12-31
运行采集.bat "Sunday City: Life RolePlay"
```

### 4. 筛选评论

**方法一：使用批处理文件（推荐，交互式）**
```bash
# 双击运行 运行筛选.bat，然后按提示操作
运行筛选.bat
```

运行后会显示游戏列表菜单，选择数字（1-10）：
- 选择 1-8：筛选对应游戏的评论
- 选择 9：自动使用最新的数据文件
- 选择 10：手动输入游戏名称

**方法二：命令行参数（高级用法）**
```bash
运行筛选.bat "游戏名称"
```

**方法三：直接运行Python脚本**
```bash
python main_simple_filter.py "游戏名称"
```

**示例：**
```bash
# 交互式（推荐）
运行筛选.bat
# 然后选择游戏

# 命令行方式
运行筛选.bat "TopTycoon"
运行筛选.bat "Sunday City: Life RolePlay"
```

## 输出文件

- **采集的数据**：`data/raw/` 目录（JSON格式）
- **筛选结果**：`output/reports/` 目录
  - **详细版**：Markdown 格式（包含完整信息）
  - **简化版**：TXT 格式（可直接复制给AI分析）

## 注意事项

1. **游戏名称必须与 config.yaml 中的配置完全一致**
   - 查看可用游戏：打开 `config.yaml` 查看 `games` 列表
   - 游戏名称区分大小写和特殊字符

2. **日期格式**
   - 必须使用 `YYYY-MM-DD` 格式
   - 例如：`2025-09-01`

3. **日志文件**
   - 采集日志：`scrape.log`
   - 筛选日志：`filter.log`

## 常见问题

**Q: 如何查看有哪些游戏可以采集？**  
A: 打开 `config.yaml` 文件，查看 `games` 部分，每个游戏都有 `name` 字段。

**Q: 如何查找游戏的 Google Play ID？**  
A: 
1. 在浏览器中打开 Google Play Store
2. 搜索游戏名称
3. 打开游戏页面
4. 查看URL，格式类似：`https://play.google.com/store/apps/details?id=com.example.game`
5. 复制包名（如：`com.example.game`）

**Q: 采集失败怎么办？**  
A: 检查 `scrape.log` 日志文件，查看具体错误信息。常见问题：
- 游戏名称不匹配
- Google Play ID 未配置
- 网络连接问题

**Q: 筛选时找不到数据文件？**  
A: 确保已经运行过采集，并且游戏名称与 config.yaml 中的配置一致。

## 地区配置

在 `config.yaml` 中可以配置采集的地区：

```yaml
scraper:
  regions:
    - name: "美国"
      lang: "en"      # 语言代码: en(英文), zh(中文), ja(日文)等
      country: "us"   # 国家代码: us(美国), cn(中国), jp(日本)等
```

### 常用地区代码

**语言代码 (lang)**
- `en` - 英文
- `zh` - 中文
- `ja` - 日文
- `ko` - 韩文
- `es` - 西班牙文
- `fr` - 法文
- `de` - 德文
- `pt` - 葡萄牙文
- `ru` - 俄文

**国家代码 (country)**
- `us` - 美国
- `cn` - 中国
- `jp` - 日本
- `kr` - 韩国
- `gb` - 英国
- `ca` - 加拿大
- `au` - 澳大利亚
- `de` - 德国
- `fr` - 法国
- `es` - 西班牙
- `it` - 意大利
- `br` - 巴西
- `in` - 印度
- `ru` - 俄罗斯

## 项目结构

```
商店评论区分析/
├── src/                    # 源代码
│   ├── scraper/           # 采集模块
│   ├── processor/         # 数据处理模块
│   └── analyzer/           # 分析模块
├── data/                   # 数据文件
│   └── raw/               # 原始评论数据
├── output/                 # 输出文件
│   └── reports/           # 筛选结果
├── config.yaml            # 配置文件
├── 采集评论.py            # 采集脚本
├── main_simple_filter.py   # 筛选脚本
├── 运行采集.bat           # 采集批处理文件
├── 运行筛选.bat           # 筛选批处理文件
└── requirements.txt       # Python依赖
```

## 工作流程

```
数据采集 → 数据清洗 → 智能筛选 → 输出文档 → AI分析
```

1. **数据采集**：从 Google Play 采集评论数据
2. **数据清洗**：清理和预处理数据
3. **智能筛选**：过滤无意义的评论，保留有价值的反馈
4. **输出文档**：生成 Markdown 和 TXT 格式的文档
5. **AI分析**：将简化版 TXT 内容复制给 AI（ChatGPT、Claude等）进行深度分析

## 依赖项

- `google-play-scraper` - Google Play 评论采集
- `pandas` - 数据处理
- `numpy` - 数值计算
- `pyyaml` - 配置文件解析
- `requests` - HTTP 请求
- `tqdm` - 进度条显示
- `python-dateutil` - 日期处理

## 许可证

本项目仅供学习和研究使用。
