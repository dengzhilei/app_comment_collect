-- 1. 找出指定注册日期的用户 (我们的分析队列)
WITH NewUsers AS (
    SELECT
        user_id,
        date(to_timestamp(cast(create_time as BIGINT)/1000)) AS reg_date
    FROM
        table.user_20652
    WHERE
        -- [!] 请在这里设定您要统计的新用户注册周期
        date(to_timestamp(cast(create_time as BIGINT)/1000)) ${PartDate:date1}

),

-- 2. 获取这些用户首日(Day 0)的map_level数据
FirstDayMapLevel AS (
    SELECT
        nu.user_id,
        nu.reg_date,
        -- 获取首日到达的最大map_level
        max(cast(e.proj_level as int)) AS day0_max_proj_level
    FROM
        NewUsers nu
    JOIN
        table.event_20652 e
        ON nu.user_id = e.user_id
    WHERE
        e.event_id='asset_circulate'
        -- 关键：首日 = 注册当天
        and e.day = nu.reg_date
        -- [!] 请根据实际情况调整event_id和map_level字段名
        -- and e.event_id = 'MAP_LEVEL_CHANGE'  -- 示例：如果是特定事件
        and e.proj_level is not null
    GROUP BY
        nu.user_id,
        nu.reg_date
)

-- 3. 最终聚合：按map_level分组统计分布（分为1、2、3、4、>=5几个区间，作为列显示）
SELECT
    reg_date,  -- 注册日期
    COUNT(user_id) AS total_users,  -- 总用户数
    -- map_level = 1 (百分比，整数，带百分号)
    CAST(ROUND(SUM(CASE WHEN day0_max_proj_level = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(user_id), 0) AS VARCHAR) || '%' AS level_1_pct,
    -- map_level = 2
    CAST(ROUND(SUM(CASE WHEN day0_max_proj_level = 2 THEN 1 ELSE 0 END) * 100.0 / COUNT(user_id), 0) AS VARCHAR) || '%' AS level_2_pct,
    -- map_level = 3
    CAST(ROUND(SUM(CASE WHEN day0_max_proj_level = 3 THEN 1 ELSE 0 END) * 100.0 / COUNT(user_id), 0) AS VARCHAR) || '%' AS level_3_pct,
    -- map_level = 4
    CAST(ROUND(SUM(CASE WHEN day0_max_proj_level = 4 THEN 1 ELSE 0 END) * 100.0 / COUNT(user_id), 0) AS VARCHAR) || '%' AS level_4_pct,
    -- map_level >= 5
    CAST(ROUND(SUM(CASE WHEN day0_max_proj_level >= 5 THEN 1 ELSE 0 END) * 100.0 / COUNT(user_id), 0) AS VARCHAR) || '%' AS level_5plus_pct
FROM
    FirstDayMapLevel
GROUP BY
    reg_date
ORDER BY
    reg_date;

