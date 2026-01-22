/*
玩家分为4组，
根据 user_20652表里：
- proj_ab_bucket_1字段：1-100 分为B1组，101-200分为A1组
- proj_ab_bucket_2字段：1-100 分为B2组，101-200分为A2组
组合成4组：A1A2, A1B2, B1A2, B1B2
对比4组玩家 的 全局进度条 奖励的骰子的 不同分位数数值

全局进度条标识：proj_asset_source = 'C_PROGRESS_REWARD' 且 proj_activity_type = '1001'
骰子ID：'100100'
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

-- 2. 计算每个玩家在期间内从全局进度条获得的骰子奖励总额
PlayerGlobalProgressDiceReward AS (
    SELECT
        e.user_id,
        SUM(CAST(e.proj_asset_value AS BIGINT)) AS total_dice_reward
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
        AND e.proj_asset_id = '100100'  -- 骰子
        AND e.proj_asset_change_type = '1'  -- 获得
        AND e.proj_asset_source = 'C_PROGRESS_REWARD'  -- 进度条奖励
        AND CAST(e.proj_activity_type AS INT) = 1001  -- 全局进度条
        AND e.proj_asset_value IS NOT NULL
        AND CAST(e.proj_asset_value AS BIGINT) > 0
        AND CAST(e.proj_level AS INT) >= 3  -- 只看map_level>=3的玩家
    GROUP BY
        e.user_id
),

-- 3. 合并数据：玩家AB组 + 全局进度条骰子奖励
PlayerStats AS (
    SELECT
        pag.user_id,
        pag.ab_group,
        COALESCE(pgdr.total_dice_reward, 0) AS total_dice_reward
    FROM
        PlayerABGroup pag
    LEFT JOIN
        PlayerGlobalProgressDiceReward pgdr
        ON pag.user_id = pgdr.user_id
    WHERE
        pag.ab_group IS NOT NULL
)

-- 4. 按AB组分组，计算全局进度条骰子奖励的分位数分布
SELECT
    ab_group,
    COUNT(user_id) AS user_count,
    -- 全局进度条骰子奖励分位数
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_dice_reward ASC), 0) AS dice_reward_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_dice_reward ASC), 0) AS dice_reward_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_dice_reward ASC), 0) AS dice_reward_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_dice_reward ASC), 0) AS dice_reward_p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_dice_reward ASC), 0) AS dice_reward_p95
FROM
    PlayerStats
GROUP BY
    ab_group
ORDER BY
    ab_group;
