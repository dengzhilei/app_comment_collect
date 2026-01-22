/*
查询限定时间内，不同maplevel的玩家，鱼饵余量分布
注意，玩家可能期间会升级，所以取期间最小值为准
余量使用金流的最后一条记录
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

-- 2. 获取每个玩家在期间内的最后一条金流记录（按时间排序）
PlayerLastRecord AS (
    SELECT
        e.user_id,
        CAST(e.proj_bait_num AS BIGINT) AS bait_balance,
        ROW_NUMBER() OVER (PARTITION BY e.user_id ORDER BY 
            COALESCE(NULLIF(CAST(e.proj_action_bg_time AS BIGINT), 0), e.event_time) DESC
        ) AS rn
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
        AND e.proj_bait_num IS NOT NULL
),

-- 3. 获取每个玩家的最后一条记录的鱼饵余量
PlayerBaitBalance AS (
    SELECT
        user_id,
        bait_balance
    FROM
        PlayerLastRecord
    WHERE
        rn = 1
),

-- 4. 合并数据：玩家最小 map_level + 鱼饵余量
PlayerStats AS (
    SELECT
        pml.user_id,
        pml.min_map_level,
        COALESCE(pbb.bait_balance, 0) AS bait_balance
    FROM
        PlayerMinMapLevel pml
    LEFT JOIN
        PlayerBaitBalance pbb
        ON pml.user_id = pbb.user_id
),

-- 5. 对 map_level 进行聚类：低等级单独显示，高等级合并
LevelClustered AS (
    SELECT
        user_id,
        bait_balance,
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

-- 6. 按聚类后的 map_level 分组，计算鱼饵余量的分位数分布
SELECT
    map_level_group AS map_level,
    COUNT(user_id) AS user_count,
    -- 鱼饵余量分位数
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY bait_balance ASC), 0) AS bait_balance_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY bait_balance ASC), 0) AS bait_balance_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY bait_balance ASC), 0) AS bait_balance_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY bait_balance ASC), 0) AS bait_balance_p90
FROM
    LevelClustered
GROUP BY
    map_level_group
ORDER BY
    MIN(min_map_level);

