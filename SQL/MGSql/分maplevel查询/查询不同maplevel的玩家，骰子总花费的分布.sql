/*
查询限定时间内，不同maplevel的玩家，骰子总花费的分布
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

-- 2. 计算每个玩家在期间内的骰子总花费
PlayerTotalDiceCost AS (
    SELECT
        e.user_id,
        COALESCE(SUM(CASE 
            WHEN e.proj_asset_id = '100100' 
            AND e.proj_asset_change_type = '2' 
            THEN CAST(e.proj_asset_value AS BIGINT) 
            ELSE 0 
        END), 0) AS total_dice_cost
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
    GROUP BY
        e.user_id
),

-- 3. 合并数据：玩家最小 map_level + 骰子总花费
PlayerStats AS (
    SELECT
        pml.user_id,
        pml.min_map_level,
        COALESCE(ptdc.total_dice_cost, 0) AS total_dice_cost
    FROM
        PlayerMinMapLevel pml
    LEFT JOIN
        PlayerTotalDiceCost ptdc
        ON pml.user_id = ptdc.user_id
),

-- 4. 对 map_level 进行聚类：低等级单独显示，高等级合并
LevelClustered AS (
    SELECT
        user_id,
        total_dice_cost,
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

-- 5. 按聚类后的 map_level 分组，计算骰子总花费的分位数分布
SELECT
    map_level_group AS map_level,
    COUNT(user_id) AS user_count,
    -- 骰子总花费分位数
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_dice_cost ASC), 0) AS dice_cost_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_dice_cost ASC), 0) AS dice_cost_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_dice_cost ASC), 0) AS dice_cost_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_dice_cost ASC), 0) AS dice_cost_p90
    --ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_dice_cost ASC), 0) AS dice_cost_p95,
    --ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY total_dice_cost ASC), 0) AS dice_cost_p99,
    -- 平均值和总和
    --ROUND(AVG(total_dice_cost), 0) AS dice_cost_avg,
    --SUM(total_dice_cost) AS dice_cost_total,
    -- 用于排序的最小等级值
    --MIN(max_map_level) AS sort_key
FROM
    LevelClustered
GROUP BY
    map_level_group
ORDER BY
    MIN(min_map_level);