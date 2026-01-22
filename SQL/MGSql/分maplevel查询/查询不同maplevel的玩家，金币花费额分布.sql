/*
查询限定时间内，不同maplevel的玩家，金币花费额分布（已除以膨胀系数）
注意，玩家可能期间会升级，所以取期间最小值为准
金币花费需要除以当时的膨胀系数（proj_reward_coin_multi）
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

-- 2. 计算每个玩家在期间内的金币花费总额（已除以膨胀系数）
PlayerCoinSpend AS (
    SELECT
        e.user_id,
        -- 金币花费需要除以当时的膨胀系数
        CAST(SUM(CAST(e.proj_asset_value AS BIGINT) / CAST(e.proj_reward_coin_multi AS INT)) AS BIGINT) AS total_coin_spend
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
        AND e.proj_asset_id = '100200'
        AND e.proj_asset_change_type = '2'
        AND e.proj_reward_coin_multi IS NOT NULL
        AND CAST(e.proj_reward_coin_multi AS INT) > 0
    GROUP BY
        e.user_id
),

-- 3. 合并数据：玩家最小 map_level + 金币花费总额
PlayerStats AS (
    SELECT
        pml.user_id,
        pml.min_map_level,
        COALESCE(pcs.total_coin_spend, 0) AS total_coin_spend
    FROM
        PlayerMinMapLevel pml
    LEFT JOIN
        PlayerCoinSpend pcs
        ON pml.user_id = pcs.user_id
),

-- 4. 对 map_level 进行聚类：低等级单独显示，高等级合并
LevelClustered AS (
    SELECT
        user_id,
        total_coin_spend,
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

-- 5. 按聚类后的 map_level 分组，计算金币花费额的分位数分布
SELECT
    map_level_group AS map_level,
    COUNT(user_id) AS user_count,
    -- 金币花费额分位数（已除以膨胀系数）
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_coin_spend ASC), 0) AS coin_spend_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_coin_spend ASC), 0) AS coin_spend_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_coin_spend ASC), 0) AS coin_spend_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_coin_spend ASC), 0) AS coin_spend_p90
FROM
    LevelClustered
GROUP BY
    map_level_group
ORDER BY
    MIN(min_map_level);

