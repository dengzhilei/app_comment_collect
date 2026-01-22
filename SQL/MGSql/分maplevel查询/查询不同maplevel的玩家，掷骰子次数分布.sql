/*
查询限定时间内，不同maplevel的玩家，掷骰子次数分布
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

-- 2. 计算每个玩家在期间内的掷骰子次数
PlayerDiceRollCount AS (
    SELECT
        e.user_id,
        COUNT(*) AS total_dice_roll_count
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
        AND e.proj_asset_id = '100100'
        AND e.proj_asset_change_type = '2'
        AND CAST(e.proj_asset_source_type AS INT) = 1
    GROUP BY
        e.user_id
),

-- 3. 合并数据：玩家最小 map_level + 掷骰子次数
PlayerStats AS (
    SELECT
        pml.user_id,
        pml.min_map_level,
        COALESCE(pdrc.total_dice_roll_count, 0) AS total_dice_roll_count
    FROM
        PlayerMinMapLevel pml
    LEFT JOIN
        PlayerDiceRollCount pdrc
        ON pml.user_id = pdrc.user_id
),

-- 4. 对 map_level 进行聚类：低等级单独显示，高等级合并
LevelClustered AS (
    SELECT
        user_id,
        total_dice_roll_count,
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

-- 5. 按聚类后的 map_level 分组，计算掷骰子次数的分位数分布
SELECT
    map_level_group AS map_level,
    COUNT(user_id) AS user_count,
    -- 掷骰子次数分位数
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_dice_roll_count ASC), 0) AS dice_roll_count_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_dice_roll_count ASC), 0) AS dice_roll_count_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_dice_roll_count ASC), 0) AS dice_roll_count_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_dice_roll_count ASC), 0) AS dice_roll_count_p90
FROM
    LevelClustered
GROUP BY
    map_level_group
ORDER BY
    MIN(min_map_level);

