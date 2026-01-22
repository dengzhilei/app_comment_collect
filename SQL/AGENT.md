写SQL前必读：
MGSql（老项目）
    是一个老项目的相关sql
    对应的项目id是20652
    对应的金流表是'asset_circulate'

NewMgSql（新项目）
    对应一个新项目的sql的文件夹
    对应的项目id是20688
    对应的金流表是'currency_change'（注意：金流用'currency_change'而不是's_currency_change'）
    详细介绍可以其目录下的"GA打点.json"

现阶段主要需求都是新项目的查询。
老项目（MGSql文件夹）记录了很多sql查询语句，写sql时请先参考老项目相关语法习惯！
字段名则参照"GA打点.json"
"GA打点.json"里的记录的<属性名>实际在查询时默认需要加上"proj_"前缀

常用字段对照：
    玩家ID: user_id
    日期: day
    骰子道具ID: 110001
    金币|钱道具ID: 100001