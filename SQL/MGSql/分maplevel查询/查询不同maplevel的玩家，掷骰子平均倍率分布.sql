/*
查询限定时间内，不同maplevel的玩家，掷骰子平均倍率分布
注意，玩家可能期间会升级，所以取期间最小值为准
*/

-- 1. 获取每个玩家在期间内的最小 map_level
WITH PlayerMinMapLevel AS (
    SELECT
        e.user_id,
        MIN(CAST(e.proj_level AS INT)) AS min_map_level
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
        AND e.proj_level IS NOT NULL
        AND CAST(e.proj_level AS INT) > 0
    GROUP BY
        e.user_id
),

-- 2. 计算每个玩家在期间内的掷骰子平均倍率
PlayerAvgBet AS (
    SELECT
        e.user_id,
        AVG(CAST(e.proj_asset_value AS INT)) AS avg_bet_multiplying
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
        AND e.proj_asset_id = '100100'
        AND e.proj_asset_change_type = '2'
        AND CAST(e.proj_asset_source_type AS INT) = 1
        AND e.proj_asset_value IS NOT NULL
        AND CAST(e.proj_asset_value AS INT) > 0
    GROUP BY
        e.user_id
),

-- 3. 合并数据：玩家最小 map_level + 平均倍率
PlayerStats AS (
    SELECT
        pml.user_id,
        pml.min_map_level,
        COALESCE(pab.avg_bet_multiplying, 0) AS avg_bet_multiplying
    FROM
        PlayerMinMapLevel pml
    LEFT JOIN
        PlayerAvgBet pab
        ON pml.user_id = pab.user_id
),

-- 4. 对 map_level 进行聚类：低等级单独显示，高等级合并
LevelClustered AS (
    SELECT
        user_id,
        avg_bet_multiplying,
        -- 聚类规则：1-5级单独显示，6-10级合并，11-15级合并，16-20级合并，21+级合并
        CASE
            WHEN min_map_level <= 5 THEN CAST(min_map_level AS VARCHAR)
            WHEN min_map_level BETWEEN 6 AND 10 THEN '6-10'
            WHEN min_map_level BETWEEN 11 AND 15 THEN '11-15'
            WHEN min_map_level BETWEEN 16 AND 20 THEN '16-20'
            ELSE '21+'
        END AS map_level_group,
        -- 保留原始等级用于排序
        min_map_level
    FROM
        PlayerStats
)

-- 5. 按聚类后的 map_level 分组，计算平均倍率的分位数分布
SELECT
    map_level_group AS map_level,
    COUNT(user_id) AS user_count,
    -- 平均倍率分位数
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY avg_bet_multiplying ASC), 0) AS avg_bet_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_bet_multiplying ASC), 0) AS avg_bet_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY avg_bet_multiplying ASC), 0) AS avg_bet_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY avg_bet_multiplying ASC), 0) AS avg_bet_p90
FROM
    LevelClustered
GROUP BY
    map_level_group
ORDER BY
    MIN(min_map_level);

