/*
按注册天数聚类，查看不同注册天数段的玩家，map_level的分位数分布
统计方式：每天的行为数据标记"当天是注册第几天"，取当天金流日志里玩家最大的map_level，然后按注册天数聚类汇总
例如：所有玩家在"注册第1天"的map_level分位数、所有玩家在"注册第2天"的map_level分位数等
*/

-- 1. 获取指定注册时间段的用户，并计算注册日期
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

-- 2. 获取每天每个玩家的所有map_level记录，并标记当天是注册第几天
DailyMapLevelRecords AS (
    SELECT
        e.user_id,
        e.day AS behavior_date,
        nu.reg_date,
        -- 计算当天是注册第几天（注册当天为第0天）
        DATEDIFF(e.day, nu.reg_date) AS reg_day,
        -- map_level
        CAST(e.proj_level AS INT) AS map_level
    FROM
        table.event_20652 e
    INNER JOIN
        NewUsers nu
        ON e.user_id = nu.user_id
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围（玩家行为统计期间）
        AND e.day ${PartDate:date2}
        AND DATEDIFF(e.day, nu.reg_date) >= 0  -- 确保行为日期不早于注册日期
        AND e.proj_level IS NOT NULL
        AND CAST(e.proj_level AS INT) > 0  -- map_level必须大于0
),

-- 3. 获取每天每个玩家的最大map_level
DailyMaxMapLevel AS (
    SELECT
        user_id,
        behavior_date,
        reg_day,
        MAX(map_level) AS daily_max_map_level
    FROM
        DailyMapLevelRecords
    GROUP BY
        user_id,
        behavior_date,
        reg_day
),

-- 4. 按注册天数聚类
RegDaysClustered AS (
    SELECT
        user_id,
        behavior_date,
        reg_day,
        daily_max_map_level,
        -- 注册天数聚类规则：0-7天细分，8-14天、15-30天、31-60天、61-90天、91+天
        CASE
            WHEN reg_day = 0 THEN '0天'
            WHEN reg_day = 1 THEN '1天'
            WHEN reg_day BETWEEN 2 AND 3 THEN '2-3天'
            WHEN reg_day BETWEEN 4 AND 7 THEN '4-7天'
            WHEN reg_day BETWEEN 8 AND 14 THEN '8-14天'
            WHEN reg_day BETWEEN 15 AND 30 THEN '15-30天'
            WHEN reg_day BETWEEN 31 AND 60 THEN '31-60天'
            WHEN reg_day BETWEEN 61 AND 90 THEN '61-90天'
            WHEN reg_day >= 91 THEN '91+天'
            ELSE '未知'
        END AS reg_days_group
    FROM
        DailyMaxMapLevel
)

-- 5. 按注册天数聚类分组，计算每天最大map_level的分位数分布
SELECT
    reg_days_group AS reg_days_range,  -- 注册天数范围聚类
    COUNT(*) AS day_count,  -- 总天数（所有玩家在该注册天数段的总天数）
    COUNT(DISTINCT user_id) AS user_count,  -- 参与该注册天数段的玩家数
    -- 每天最大map_level分位数（所有玩家在该注册天数段的每天最大map_level）
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY daily_max_map_level ASC), 0) AS daily_max_map_level_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY daily_max_map_level ASC), 0) AS daily_max_map_level_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY daily_max_map_level ASC), 0) AS daily_max_map_level_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY daily_max_map_level ASC), 0) AS daily_max_map_level_p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY daily_max_map_level ASC), 0) AS daily_max_map_level_p95,
    -- 平均值和最大最小值
    ROUND(AVG(daily_max_map_level), 0) AS daily_max_map_level_avg,
    MIN(daily_max_map_level) AS daily_max_map_level_min,
    MAX(daily_max_map_level) AS daily_max_map_level_max
FROM
    RegDaysClustered
GROUP BY
    reg_days_group
ORDER BY
    MIN(reg_day);

