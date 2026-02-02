"""
统一配置加载
从项目根目录的 config.yaml 读取配置，供 scrape、filter、interactive 等模块使用。
"""
import yaml
from pathlib import Path
from typing import Optional

_CONFIG_PATH: Optional[Path] = None


def get_config_path() -> Path:
    """配置文件的绝对路径（项目根目录下的 config.yaml）"""
    global _CONFIG_PATH
    if _CONFIG_PATH is None:
        # 以 src 的父目录为项目根
        _CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.yaml"
    return _CONFIG_PATH


def load_config() -> dict:
    """
    加载 config.yaml，返回完整配置字典。
    若文件不存在会抛出 FileNotFoundError，由调用方决定是否退出。
    """
    path = get_config_path()
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_games_list(config: Optional[dict] = None) -> list:
    """返回 games 列表；若未传入 config 则先 load_config()。"""
    if config is None:
        config = load_config()
    return config.get("games", [])


def get_game_by_name(name: str, config: Optional[dict] = None) -> Optional[dict]:
    """按游戏名称查找配置，找不到返回 None。"""
    for game in get_games_list(config):
        if game.get("name") == name:
            return game
    return None


def get_scraper_config(config: Optional[dict] = None) -> dict:
    """返回 scraper 配置段；若未传入 config 则先 load_config()。"""
    if config is None:
        config = load_config()
    return config.get("scraper", {})


def save_config(config: dict) -> None:
    """将配置写回 config.yaml（如添加新游戏后）。"""
    path = get_config_path()
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
