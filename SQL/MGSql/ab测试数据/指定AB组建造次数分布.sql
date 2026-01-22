/*
指定AB测试分组建造次数分布（花费金币次数）

AB测试分组规则：
- A1组：proj_ab_bucket_1 在 101-200
- A2组：proj_ab_bucket_2 在 101-200
- B1组：proj_ab_bucket_1 在 1-100
- B2组：proj_ab_bucket_2 在 1-100

查询限定时间内，指定AB测试分组中不同maplevel的玩家，建造次数分布（花费金币次数）
注意，玩家可能期间会升级，所以取期间最小值为准
*/

-- 1. 获取指定AB测试分组的玩家信息
WITH ABGroupUsers AS (
    SELECT
        proj_simple_game_id AS user_id,
        CAST(proj_ab_bucket_1 AS INT) AS ab_bucket_1,
        CAST(proj_ab_bucket_2 AS INT) AS ab_bucket_2
    FROM
        table.user_20652
    WHERE
        proj_ab_bucket_1 IS NOT NULL
        AND CAST(proj_ab_bucket_1 AS INT) BETWEEN 1 AND 200
        AND proj_ab_bucket_2 IS NOT NULL
        AND CAST(proj_ab_bucket_2 AS INT) BETWEEN 1 AND 200
        -- [!] 请在这里指定要查询的AB组：'A1', 'A2', 'B1', 'B2'
        -- A1组：proj_ab_bucket_1 在 101-200
        -- A2组：proj_ab_bucket_2 在 101-200
        -- B1组：proj_ab_bucket_1 在 1-100
        -- B2组：proj_ab_bucket_2 在 1-100
        AND (
            -- 根据要查询的AB组，取消对应的注释
            -- A1组
            -- CAST(proj_ab_bucket_1 AS INT) BETWEEN 101 AND 200
            -- A2组
            -- CAST(proj_ab_bucket_2 AS INT) BETWEEN 101 AND 200
            -- B1组
            -- CAST(proj_ab_bucket_1 AS INT) BETWEEN 1 AND 100
            -- B2组
            CAST(proj_ab_bucket_1 AS INT) BETWEEN 1 AND 100
        )
),

-- 2. 获取每个玩家在期间内的最小 map_level（仅限指定AB组的玩家）
PlayerMinMapLevel AS (
    SELECT
        e.proj_simple_game_id AS user_id,
        MIN(CAST(e.proj_level AS INT)) AS min_map_level
    FROM
        table.event_20652 e
    INNER JOIN
        ABGroupUsers abu
        ON e.proj_simple_game_id = abu.user_id
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
        AND e.proj_level IS NOT NULL
        AND CAST(e.proj_level AS INT) > 0
    GROUP BY
        e.proj_simple_game_id
),

-- 3. 计算每个玩家在期间内的建造次数（花费金币次数，仅限指定AB组的玩家）
PlayerBuildCount AS (
    SELECT
        e.proj_simple_game_id AS user_id,
        COUNT(*) AS total_build_count
    FROM
        table.event_20652 e
    INNER JOIN
        ABGroupUsers abu
        ON e.proj_simple_game_id = abu.user_id
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
        AND e.proj_asset_id = '100200'
        AND e.proj_asset_change_type = '2'
    GROUP BY
        e.proj_simple_game_id
),

-- 4. 合并数据：玩家最小 map_level + 建造次数
PlayerStats AS (
    SELECT
        pml.user_id,
        pml.min_map_level,
        COALESCE(pbc.total_build_count, 0) AS total_build_count
    FROM
        PlayerMinMapLevel pml
    LEFT JOIN
        PlayerBuildCount pbc
        ON pml.user_id = pbc.user_id
),

-- 5. 对 map_level 进行聚类：低等级单独显示，高等级合并
LevelClustered AS (
    SELECT
        user_id,
        total_build_count,
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

-- 6. 按聚类后的 map_level 分组，计算建造次数的分位数分布
SELECT
    map_level_group AS map_level,
    COUNT(user_id) AS user_count,
    -- 建造次数分位数
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_build_count ASC), 0) AS build_count_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_build_count ASC), 0) AS build_count_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_build_count ASC), 0) AS build_count_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_build_count ASC), 0) AS build_count_p90
FROM
    LevelClustered
GROUP BY
    map_level_group
ORDER BY
    MIN(min_map_level);

