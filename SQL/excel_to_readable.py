# -*- coding: utf-8 -*-
"""
将多页签Excel转换为AI可读的JSON格式
专门优化"事件-属性"类型的打点文档
"""

import os
import json
import sys

try:
    import pandas as pd
except ImportError:
    print("需要安装 pandas 库，请运行: pip install pandas openpyxl")
    sys.exit(1)


def excel_to_event_json(excel_path, output_path=None):
    """
    将Excel转换为按事件聚合的JSON格式
    适用于"事件打点"类文档（一个事件对应多个属性行）
    """
    if output_path is None:
        output_path = os.path.splitext(excel_path)[0] + ".json"
    
    xlsx = pd.ExcelFile(excel_path)
    sheet_names = xlsx.sheet_names
    
    result = {}
    
    for sheet_name in sheet_names:
        df = pd.read_excel(xlsx, sheet_name=sheet_name)
        
        if df.empty:
            result[sheet_name] = []
            continue
        
        # 获取列名（去除括号内的说明文字，简化列名）
        col_map = {}
        for col in df.columns:
            simple_name = str(col).split('（')[0].strip()
            col_map[col] = simple_name
        
        df = df.rename(columns=col_map)
        columns = list(df.columns)
        
        # 判断是否有事件名列
        has_event_col = any('事件名' in str(col) for col in columns)
        
        if has_event_col:
            # 有事件名列：按事件聚合
            events = parse_event_sheet(df)
            result[sheet_name] = events
        else:
            # 无事件名列：作为公共属性列表处理
            attrs = parse_attr_only_sheet(df)
            result[sheet_name] = {"公共属性": attrs}
    
    # 写入文件
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # 统计信息
    total_events = 0
    total_attrs = 0
    for sheet_name, data in result.items():
        if isinstance(data, list):
            total_events += len(data)
            total_attrs += sum(len(e.get('属性', [])) for e in data)
        elif isinstance(data, dict) and '公共属性' in data:
            total_attrs += len(data['公共属性'])
    
    print(f"已转换为 JSON: {output_path}")
    print(f"  共 {len(sheet_names)} 个页签, {total_events} 个事件, {total_attrs} 个属性")
    
    return output_path


def parse_event_sheet(df):
    """解析有事件名的sheet"""
    events = []
    current_event = None
    
    for _, row in df.iterrows():
        event_name = _get_val(row, '事件名')
        
        # 判断是否是新事件（事件名非空）
        if event_name:
            # 保存上一个事件
            if current_event:
                events.append(current_event)
            
            # 创建新事件
            current_event = {
                "事件名": event_name,
                "显示名": _get_val(row, '事件显示名'),
                "标签": _get_val(row, '事件标签'),
                "日志级别": _get_val(row, '事件日志级别'),
                "是否接收": _get_val(row, '事件是否接收'),
                "说明": _get_val(row, '事件说明'),
                "属性": []
            }
        
        # 添加属性
        if current_event:
            attr = _extract_attr(row)
            if attr:
                current_event["属性"].append(attr)
    
    # 添加最后一个事件
    if current_event:
        events.append(current_event)
    
    return events


def parse_attr_only_sheet(df):
    """解析只有属性的sheet（如公共字段）"""
    attrs = []
    
    for _, row in df.iterrows():
        attr = _extract_attr(row)
        if attr:
            attrs.append(attr)
    
    return attrs


def _extract_attr(row):
    """从行中提取属性信息"""
    attr_name = _get_val(row, '属性名')
    if not attr_name:
        return None
    
    # 跳过看起来像是说明文字的行（包含换行符或冒号说明）
    if '\n' in attr_name or (': ' in attr_name and len(attr_name) > 50):
        return None
    
    attr = {
        "属性名": attr_name,
        "显示名": _get_val(row, '属性显示名'),
        "类型": _get_val(row, '属性类型'),
        "格式": _get_val(row, '单位/格式') or _get_val(row, '单位') or _get_val(row, '格式'),
        "说明": _get_val(row, '属性说明')
    }
    # 过滤空值
    attr = {k: v for k, v in attr.items() if v}
    
    return attr if attr.get('属性名') else None


def _get_val(row, col_prefix):
    """获取行中匹配列前缀的值"""
    for col in row.index:
        if str(col).startswith(col_prefix):
            val = row[col]
            if pd.notna(val):
                val_str = str(val).strip()
                if val_str and val_str.lower() != 'nan':
                    return val_str
    return None


# ================== 使用 ==================
if __name__ == "__main__":
    if len(sys.argv) > 1:
        excel_file = sys.argv[1]
    else:
        excel_file = r"GA打点.xlsx"
    
    if not os.path.exists(excel_file):
        print(f"文件不存在: {excel_file}")
        print("\n使用方法: python excel_to_readable.py <Excel文件路径>")
    else:
        print(f"\n正在处理: {excel_file}")
        print("=" * 60)
        excel_to_event_json(excel_file)
        print("\n转换完成！")
