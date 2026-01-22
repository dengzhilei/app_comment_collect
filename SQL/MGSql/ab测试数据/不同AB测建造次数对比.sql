/*
玩家分为4组，
根据 user_20652表里：
- proj_ab_bucket_1字段：1-100 分为B1组，101-200分为A1组
- proj_ab_bucket_2字段：1-100 分为B2组，101-200分为A2组
组合成4组：A1A2, A1B2, B1A2, B1B2
对比4组玩家 的 建造次数 的不同分位数数值

建造次数：花费金币的次数（proj_asset_id = '100200' 且 proj_asset_change_type = '2'）
*/

-- 1. 获取玩家的AB测试分组（从 user_20652 表，包含两个维度）
WITH PlayerABGroup AS (
    SELECT
        user_id,
        CASE
            WHEN CAST(proj_ab_bucket_1 AS INT) BETWEEN 1 AND 100 THEN 'B1'
            WHEN CAST(proj_ab_bucket_1 AS INT) BETWEEN 101 AND 200 THEN 'A1'
            ELSE NULL
        END AS ab_group_1,
        CASE
            WHEN CAST(proj_ab_bucket_2 AS INT) BETWEEN 1 AND 100 THEN 'B2'
            WHEN CAST(proj_ab_bucket_2 AS INT) BETWEEN 101 AND 200 THEN 'A2'
            ELSE NULL
        END AS ab_group_2,
        -- 组合两个维度，形成4组
        CONCAT(
            CASE
                WHEN CAST(proj_ab_bucket_1 AS INT) BETWEEN 1 AND 100 THEN 'B1'
                WHEN CAST(proj_ab_bucket_1 AS INT) BETWEEN 101 AND 200 THEN 'A1'
                ELSE NULL
            END,
            CASE
                WHEN CAST(proj_ab_bucket_2 AS INT) BETWEEN 1 AND 100 THEN 'B2'
                WHEN CAST(proj_ab_bucket_2 AS INT) BETWEEN 101 AND 200 THEN 'A2'
                ELSE NULL
            END
        ) AS ab_group
    FROM
        table.user_20652
    WHERE
        proj_ab_bucket_1 IS NOT NULL
        AND CAST(proj_ab_bucket_1 AS INT) BETWEEN 1 AND 200
        AND proj_ab_bucket_2 IS NOT NULL
        AND CAST(proj_ab_bucket_2 AS INT) BETWEEN 1 AND 200
        AND CAST(proj_level AS INT) >= 3  -- 只看map_level>=3的玩家
),

-- 2. 计算每个玩家在期间内的建造次数（花费金币次数）
PlayerBuildCount AS (
    SELECT
        e.user_id,
        COUNT(*) AS total_build_count
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
        AND e.proj_asset_id = '100200'  -- 金币
        AND e.proj_asset_change_type = '2'  -- 消耗
        AND CAST(e.proj_level AS INT) >= 3  -- 只看map_level>=3的玩家
    GROUP BY
        e.user_id
),

-- 3. 合并数据：玩家AB组 + 建造次数
PlayerStats AS (
    SELECT
        pag.user_id,
        pag.ab_group,
        COALESCE(pbc.total_build_count, 0) AS total_build_count
    FROM
        PlayerABGroup pag
    LEFT JOIN
        PlayerBuildCount pbc
        ON pag.user_id = pbc.user_id
    WHERE
        pag.ab_group IS NOT NULL
)

-- 4. 按AB组分组，计算建造次数的分位数分布
SELECT
    ab_group,
    COUNT(user_id) AS user_count,
    -- 建造次数分位数
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_build_count ASC), 0) AS build_count_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_build_count ASC), 0) AS build_count_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_build_count ASC), 0) AS build_count_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_build_count ASC), 0) AS build_count_p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_build_count ASC), 0) AS build_count_p95
FROM
    PlayerStats
GROUP BY
    ab_group
ORDER BY
    ab_group;

