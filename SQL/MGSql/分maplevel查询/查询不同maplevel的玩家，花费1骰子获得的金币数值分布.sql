/*
查询限定时间内，不同maplevel的玩家，花费1骰子获得的金币数值分布（已除以膨胀系数）
注意，玩家可能期间会升级，所以取期间最小值为准
金币产出需要除以当时的膨胀系数（proj_reward_coin_multi）
计算方式：金币产出（已除膨胀系数）/ 骰子花费
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

-- 2. 计算每个玩家在期间内的金币产出总额（已除以膨胀系数）
PlayerCoinOutput AS (
    SELECT
        e.user_id,
        -- 金币产出需要除以当时的膨胀系数
        CAST(SUM(CAST(e.proj_asset_value AS BIGINT) / CAST(e.proj_reward_coin_multi AS INT)) AS BIGINT) AS total_coin_output
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
        AND e.proj_asset_id = '100200'
        AND e.proj_asset_change_type = '1'
        AND e.proj_reward_coin_multi IS NOT NULL
        AND CAST(e.proj_reward_coin_multi AS INT) > 0
    GROUP BY
        e.user_id
),

-- 3. 计算每个玩家在期间内的骰子花费总额
PlayerDiceCost AS (
    SELECT
        e.user_id,
        SUM(CAST(e.proj_asset_value AS BIGINT)) AS total_dice_cost
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
        AND e.proj_asset_id = '100100'
        AND e.proj_asset_change_type = '2'
    GROUP BY
        e.user_id
),

-- 4. 合并数据：玩家最小 map_level + 金币产出 + 骰子花费，计算每骰子获得金币数
PlayerStats AS (
    SELECT
        pml.user_id,
        pml.min_map_level,
        COALESCE(pco.total_coin_output, 0) AS total_coin_output,
        COALESCE(pdc.total_dice_cost, 0) AS total_dice_cost,
        -- 计算每骰子获得的金币数（金币产出/骰子花费），如果骰子花费为0则设为0
        CASE
            WHEN COALESCE(pdc.total_dice_cost, 0) > 0 THEN
                CAST(COALESCE(pco.total_coin_output, 0) / pdc.total_dice_cost AS INT)
            ELSE 0
        END AS coin_per_dice
    FROM
        PlayerMinMapLevel pml
    LEFT JOIN
        PlayerCoinOutput pco
        ON pml.user_id = pco.user_id
    LEFT JOIN
        PlayerDiceCost pdc
        ON pml.user_id = pdc.user_id
    -- 只统计骰子花费大于100的玩家（排除异常数据）
    WHERE
        COALESCE(pdc.total_dice_cost, 0) > 100
),

-- 5. 对 map_level 进行聚类：低等级单独显示，高等级合并
LevelClustered AS (
    SELECT
        user_id,
        coin_per_dice,
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

-- 6. 按聚类后的 map_level 分组，计算每骰子获得金币数的分位数分布
SELECT
    map_level_group AS map_level,
    COUNT(user_id) AS user_count,
    -- 每骰子获得金币数分位数（已除膨胀系数）
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY coin_per_dice ASC), 0) AS coin_per_dice_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY coin_per_dice ASC), 0) AS coin_per_dice_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY coin_per_dice ASC), 0) AS coin_per_dice_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY coin_per_dice ASC), 0) AS coin_per_dice_p90
FROM
    LevelClustered
GROUP BY
    map_level_group
ORDER BY
    MIN(min_map_level);

