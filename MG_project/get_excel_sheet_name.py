# -*- coding: utf-8 -*-
"""
获取 Excel 文件中的所有工作表名称
运行后交互式输入 Excel 文件名，默认在 Luban Config 目录下查找
"""

import os

# 默认目录：只需输入 Excel 文件名时从此路径查找
DEFAULT_DIR = r"C:\Users\TU\Documents\MgFish\Luban\Config"


def get_sheet_names(excel_path):
    """
    获取指定 Excel 文件中所有工作表的名称。
    :param excel_path: Excel 文件路径（.xlsx）
    :return: 工作表名称列表，失败返回 None
    """
    try:
        import openpyxl
    except ImportError:
        print("请先安装 openpyxl: pip install openpyxl")
        return None

    if not os.path.isfile(excel_path):
        print("文件不存在: {}".format(excel_path))
        return None

    if not excel_path.lower().endswith(('.xlsx', '.xlsm')):
        print("仅支持 .xlsx / .xlsm 格式: {}".format(excel_path))
        return None

    try:
        wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
        names = wb.sheetnames
        wb.close()
        return names
    except Exception as e:
        print("读取失败 {}: {}".format(excel_path, e))
        return None


def main():
    print("默认路径: {}".format(DEFAULT_DIR))
    name = input("请输入 Excel 文件名: ").strip()
    if not name:
        print("未输入文件名")
        return

    # 若已是绝对路径且存在则直接用，否则在默认目录下按文件名查找
    if os.path.isabs(name) and os.path.isfile(name):
        excel_path = name
    else:
        if not name.lower().endswith(('.xlsx', '.xlsm')):
            name = name + ".xlsx"
        excel_path = os.path.join(DEFAULT_DIR, name)

    names = get_sheet_names(excel_path)
    if names is not None:
        excel_full_name = os.path.basename(excel_path)
        for n in names:
            print("{}@{}".format(n, excel_full_name))


if __name__ == "__main__":
    main()
