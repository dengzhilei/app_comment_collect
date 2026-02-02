# src 目录结构说明

本文档梳理 `src` 下各模块的职责与调用关系，便于维护与扩展。

---

## 目录结构（实际参与运行的 .py）

```
src/
├── __init__.py
├── config.py               # 统一配置：从项目根 config.yaml 加载/保存，供 scrape、filter、interactive 使用
├── scrape.py               # 采集入口：从 Google Play 拉取评论并保存 JSON
├── filter.py               # 筛选入口：读 JSON → 清洗 → 评分 → 输出精选 TXT
├── translate_reviews.py    # 翻译入口：读 reports 下 TXT，调用 DeepSeek 输出中文到 reports_chs
├── deepseek_api.py         # DeepSeek 连通性测试脚本（独立小工具）
├── scraper/                # 采集实现
│   ├── __init__.py
│   └── playstore_scraper.py   # Google Play 评论/搜索 API 封装
├── processor/              # 数据处理
│   ├── __init__.py
│   └── data_cleaner.py       # 评论去重、缺失值、时间与评分标准化
├── analyzer/               # 评论分析与筛选逻辑
│   ├── __init__.py
│   └── review_filter.py      # 长度过滤 + 多维度权重评分（HolisticDesignScorer / ReviewFilter）
└── interactive/            # 交互式流程编排
    ├── __init__.py
    ├── input.py               # 游戏名输入、config/搜索二选一、时间范围选择
    └── scrape_and_filter.py   # 串联：input → scrape → filter
```

**说明：** 已清理无对应 `.py` 的旧 `.pyc`（如 content_classifier、appstore_scraper、text_preprocessor 等）。配置统一由 `config.py` 从项目根 `config.yaml` 加载。

---

## 数据流概览

```
config.yaml
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  interactive/                                                    │
│  input.py：输入游戏名 → config 匹配 or Google 搜索 → 选时间范围    │
│  scrape_and_filter.py：顺序调用 scrape → filter                 │
└─────────────────────────────────────────────────────────────────┘
    │
    ├──► scrape.py ──► scraper/playstore_scraper.py
    │         │              │
    │         │              └── get_reviews / search_apps / save_reviews
    │         └── 写出 data/raw/{游戏名}_android_{地区}_{时间范围}.json
    │
    └──► filter.py ──► processor/data_cleaner.py  ──► analyzer/review_filter.py
              │                    │                            │
              │                    └── clean_reviews / process_dataframe
              │                    └── filter_by_length(min_length=50)
              │                    └── score_reviews（星级/情绪/感官/玩法/愿望/长度）
              └── 写出 output/reports/{游戏名}_{时间范围}_精选评论_{时间戳}.txt

translate_reviews.py（独立）
    │
    ├── 读 output/reports/*.txt，排除已有 output/reports_chs/*_中文.txt 的文件
    ├── 解析评论块 → 按 token 分批 → 并发调用 DeepSeek 翻译
    └── 写出 output/reports_chs/{原名}_中文.txt
```

---

## 各模块逻辑摘要

### 配置层

| 文件 | 作用 |
|------|------|
| **config.py** | 统一加载/保存项目根 `config.yaml`：`get_config_path()`、`load_config()`、`get_games_list()`、`get_game_by_name()`、`get_scraper_config()`、`save_config()`。scrape、filter、interactive 均通过本模块读配置。 |

### 入口层（项目根下通过 `python -m src.xxx` 或 bat 调用）

| 文件 | 作用 | 输入 | 输出 |
|------|------|------|------|
| **scrape.py** | 采集单款游戏的 Google Play 评论 | 游戏名、可选起止日期；依赖 config 中的 playstore_id 与 scraper 配置 | `data/raw/{游戏名}_android_{地区}_{时间范围}.json` |
| **filter.py** | 对已采集的 JSON 做清洗与筛选 | 可选游戏名；无则自动选最新 JSON，并从 config 或文件名推断游戏名 | `output/reports/{游戏名}_{时间范围}_精选评论_{时间戳}.txt` |
| **translate_reviews.py** | 将精选评论 TXT 翻译成中文 | 交互选择 `output/reports/` 下未翻译的 TXT | `output/reports_chs/{原名}_中文.txt` |
| **deepseek_api.py** | 测试 DeepSeek API 是否可用 | 无 | 打印一次对话回复 |

### scraper/ — 采集实现

| 文件 | 作用 |
|------|------|
| **playstore_scraper.py** | 封装 Google Play 评论与搜索：`get_reviews`（按时间范围、数量拉取）、`search_apps`（按关键词搜应用）、`get_app_info`、`save_reviews`；内含备用网页抓取 `_fallback_search`。 |

### processor/ — 数据清洗

| 文件 | 作用 |
|------|------|
| **data_cleaner.py** | 将原始评论列表转为 DataFrame：去重（review_id + platform + game_name）、补全 content/title/rating、统一 date、rating 裁剪到 1–5、去空内容；`process_dataframe` 中生成 `content_cleaned` 等供后续筛选使用。 |

### analyzer/ — 评论筛选与打分

| 文件 | 作用 |
|------|------|
| **review_filter.py** | **HolisticDesignScorer**：按星级（2–4 星加分）、情绪/感官/玩法/愿望关键词、评论长度计算综合分。**ReviewFilter**：`filter_by_length(min_length=50)`；`score_reviews` 对每条评论打分并附加 score_details。筛选流程在 `filter.py` 中调用：先长度过滤，再打分，最后取前 500 条。 |

### interactive/ — 交互与流程编排

| 文件 | 作用 |
|------|------|
| **input.py** | 读 config；单次输入游戏名 → 在 config 中匹配（支持多匹配选一或「去 Google 搜索」）→ 无匹配则直接调 PlayStore 搜索；再选时间范围（默认最近一年 / 自定义）。提供 `interactive_scrape_input()`、`interactive_filter_input()`、`search_and_select_game()`、`add_game_to_config()` 等。 |
| **scrape_and_filter.py** | 调用 `interactive_scrape_input()` 得到游戏名与时间 → `subprocess` 执行 `src.scrape` → 成功后执行 `src.filter`，完成「采集 + 筛选」一条龙。 |

---

## 可选优化方向（非必须）

1. **config 加载**  
   已统一为 `src/config.py`：`load_config()`、`get_games_list()`、`get_game_by_name()`、`get_scraper_config()`、`get_config_path()`、`save_config()`；`scrape`、`filter`、`interactive/input` 均从该模块取配置。

2. **deepseek_api.py 定位**  
   作为独立测试脚本，保留在 `src` 没问题；若希望「所有对外可执行入口」更清晰，可在 README 或项目说明里注明「仅用于验证 DeepSeek 环境」，或改名为 `scripts/test_deepseek.py` 之类便于区分。

3. **__pycache__ 清理**  
   已删除无对应 `.py` 的旧 `.pyc`（analyzer 5 个、processor 1 个、scraper 2 个、src 根 3 个）。

4. **翻译与采集/筛选的耦合**  
   当前翻译仅依赖 `output/reports/` 与 `output/reports_chs/` 的路径约定，与 `scraper`/`processor`/`analyzer` 无直接依赖，结构已清晰，无需为优化而强行合并。

---

## 依赖关系简图

```
config.py          → yaml, pathlib（项目根 config.yaml）
scrape.py          → scraper.playstore_scraper, config
filter.py          → processor.data_cleaner, analyzer.review_filter, config
translate_reviews  → openai(AsyncOpenAI), pathlib（无其它 src 子模块）
interactive.input  → scraper.playstore_scraper, config
scrape_and_filter  → interactive.input, subprocess(调用 src.scrape / src.filter)
```

以上为当前 `src` 的结构梳理与逻辑总结，便于后续修改或扩展时快速定位。
