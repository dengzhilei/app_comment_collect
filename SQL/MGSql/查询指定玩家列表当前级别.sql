/*
查询玩家发生指定事件时的当前级别（map_level）
从 event_20652 表查询金流事件，筛选条件：
- event_id = 'asset_circulate'
- proj_asset_source = 'DoneFollow'
- proj_arg_1 = '2'
如果有多条记录则显示多条
*/

SELECT
    e.proj_simple_game_id AS user_id,
    CAST(e.proj_level AS INT) AS event_map_level,
    CAST(e.proj_star_level AS INT) AS event_star_level,
    -- 事件发生日期
    e.day AS event_date,
    -- 事件发生时间（优先使用proj_action_bg_time，如果为空则使用event_time）
    from_unixtime(cast(COALESCE(NULLIF(CAST(e.proj_action_bg_time AS BIGINT), 0), e.event_time)/1000 as bigint),'yyyy-MM-dd HH:mm:ss') AS event_time,
    -- 事件相关字段
    e.proj_asset_source,
    e.proj_arg_1,
    -- 资产相关字段（如果有）
    e.proj_asset_id,
    e.proj_asset_value,
    e.proj_asset_change_type
FROM
    table.event_20652 e
WHERE
    e.event_id = 'asset_circulate'
    AND e.proj_asset_source = 'DoneFollow'
    AND e.proj_arg_1 = '2'
    -- [!] 请在这里设定要查询的玩家ID列表（用逗号分隔，如果为空则查询所有玩家）
    AND (
        -- 如果不需要筛选玩家，可以注释掉下面这行
        e.proj_simple_game_id IN (
'20098641',
'20098431',
'20098820',
'20098926',
'20099128',
'20098956',
'20099162',
'20099044',
'20100314',
'20100306',
'20100121',
'20099844',
'20099515'
            -- 可以继续添加更多玩家ID
        )
        -- 如果需要查询所有玩家，可以注释掉上面的 IN 条件
    )
    -- [!] 请在这里设定要统计的日期范围
    AND e.day ${PartDate:date1}
    AND e.proj_level IS NOT NULL
ORDER BY
    e.proj_simple_game_id,
    e.day,
    COALESCE(NULLIF(CAST(e.proj_action_bg_time AS BIGINT), 0), e.event_time);

