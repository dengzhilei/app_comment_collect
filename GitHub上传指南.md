# GitHub 上传指南

## 准备工作

### 1. 确保已安装 Git

检查是否已安装：
```bash
git --version
```

如果未安装，请访问：https://git-scm.com/downloads

### 2. 创建 GitHub 仓库

1. 登录 GitHub：https://github.com
2. 点击右上角 "+" → "New repository"
3. 填写仓库信息：
   - Repository name: `game-reviews-analyzer`（或你喜欢的名字）
   - Description: `游戏商店评论采集和智能筛选工具`
   - 选择 Public 或 Private
   - **不要**勾选 "Initialize this repository with a README"（因为本地已有）
4. 点击 "Create repository"

## 上传步骤

### 方法1：使用命令行（推荐）

#### 步骤1：初始化Git仓库

在项目目录下打开终端（CMD或PowerShell），运行：

```bash
# 进入项目目录
cd C:\Users\TU\Desktop\商店评论区分析

# 初始化Git仓库
git init

# 添加所有文件到暂存区
git add .

# 查看将要提交的文件（可选）
git status
```

#### 步骤2：创建首次提交

```bash
# 创建首次提交
git commit -m "Initial commit: 游戏评论采集和筛选工具"
```

#### 步骤3：连接GitHub仓库

```bash
# 添加远程仓库（将 YOUR_USERNAME 和 YOUR_REPO_NAME 替换为你的实际信息）
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 例如：
# git remote add origin https://github.com/yourusername/game-reviews-analyzer.git
```

#### 步骤4：推送到GitHub

```bash
# 推送到GitHub（首次推送）
git branch -M main
git push -u origin main
```

如果提示输入用户名和密码：
- 用户名：你的GitHub用户名
- 密码：使用 Personal Access Token（不是GitHub密码）

**如何创建Personal Access Token：**
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. 勾选 `repo` 权限
4. 生成后复制token（只显示一次，请保存好）
5. 推送时密码处输入这个token

### 方法2：使用GitHub Desktop（图形界面，更简单）

1. **下载GitHub Desktop**：https://desktop.github.com/
2. **安装并登录**你的GitHub账户
3. **添加本地仓库**：
   - File → Add Local Repository
   - 选择项目目录：`C:\Users\TU\Desktop\商店评论区分析`
4. **提交更改**：
   - 在左侧勾选要提交的文件
   - 填写提交信息："Initial commit"
   - 点击 "Commit to main"
5. **发布到GitHub**：
   - 点击 "Publish repository"
   - 填写仓库名称和描述
   - 选择 Public 或 Private
   - 点击 "Publish repository"

## 后续更新

当你修改代码后，需要更新GitHub：

```bash
# 添加修改的文件
git add .

# 提交更改
git commit -m "更新说明：描述你做了什么修改"

# 推送到GitHub
git push
```

## 注意事项

### 不会上传的文件

根据 `.gitignore` 配置，以下文件**不会**上传：
- ✅ 日志文件（*.log）
- ✅ 数据文件（data/raw/*, data/processed/*）
- ✅ 输出文件（output/reports/*, output/charts/*）
- ✅ Python缓存（__pycache__/）
- ✅ 虚拟环境（venv/）

### 需要上传的文件

以下文件**会**上传：
- ✅ 源代码（src/）
- ✅ 配置文件（config.yaml, requirements.txt）
- ✅ 主程序（main_simple_filter.py, test_scraper.py）
- ✅ 文档（README.md, 使用说明.md等）
- ✅ 批处理文件（*.bat）

### 敏感信息

如果 `config.yaml` 包含敏感信息（如API密钥），建议：
1. 在 `.gitignore` 中取消注释 `# config.yaml`
2. 或创建 `config.yaml.example` 作为模板（不包含真实ID）

## 常见问题

### Q: 推送时提示 "remote: Support for password authentication was removed"
A: 需要使用 Personal Access Token，而不是GitHub密码。参考上面的步骤创建token。

### Q: 如何更新README？
A: 修改 `README.md` 后：
```bash
git add README.md
git commit -m "更新README"
git push
```

### Q: 如何删除已上传的文件？
A: 
```bash
git rm 文件名
git commit -m "删除文件"
git push
```

### Q: 如何查看上传状态？
A: 
```bash
git status  # 查看本地状态
git log     # 查看提交历史
```

## 快速命令参考

```bash
# 初始化
git init
git add .
git commit -m "Initial commit"

# 连接远程仓库
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 推送
git branch -M main
git push -u origin main

# 后续更新
git add .
git commit -m "更新说明"
git push
```

