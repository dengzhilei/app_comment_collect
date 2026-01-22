-- 步骤1: 定义"全量玩家"（按天计算，当天骰子消耗>=100的用户）
WITH all_players AS (
    SELECT
        day,
        proj_simple_game_id,
        SUM(CAST(proj_asset_value AS BIGINT)) AS cost_dice
    FROM
        table.event_20652
    WHERE
        event_id = 'asset_circulate'
        AND day ${PartDate:date1}
        AND proj_asset_id = '100100'
        AND CAST(proj_level AS numeric) >= 4
        AND proj_asset_change_type = '2'
    GROUP BY
        day,
        proj_simple_game_id
    HAVING
        SUM(CAST(proj_asset_value AS BIGINT)) >= 100  -- 当天骰子消耗>=100
),

-- 步骤2: 计算实际的金币产出（按来源类型和日期）
actual_coin_output AS (
    SELECT
        day,
        proj_simple_game_id,
        proj_asset_source_type,
        CAST(SUM(CAST(proj_asset_value AS BIGINT) / proj_reward_coin_multi) AS INT) AS reward_coin
    FROM
        table.event_20652
    WHERE
        event_id = 'asset_circulate'
        AND day ${PartDate:date1}
        AND proj_asset_id = '100200'
        AND CAST(proj_level AS numeric) >= 4
        AND proj_asset_change_type = '1'
        AND CAST(proj_asset_source_type AS INT) IN (1, 5, 6)  -- 只保留棋盘、活动、钓鱼三类
    GROUP BY
        day,
        proj_simple_game_id,
        proj_asset_source_type
),

-- 步骤3: 获取所有相关的来源类型（只保留棋盘、活动、钓鱼）
all_relevant_source_types AS (
    SELECT DISTINCT
        proj_asset_source_type
    FROM
        actual_coin_output
    WHERE
        CAST(proj_asset_source_type AS INT) IN (1, 5, 6)  -- 只保留棋盘、活动、钓鱼三类
),

-- 步骤4: 创建"全量矩阵" (所有玩家 x 所有来源类型 x 日期) 并用 0 填充缺失的产出
padded_data AS (
    SELECT
        p.day,
        p.proj_simple_game_id,
        p.cost_dice,
        s.proj_asset_source_type,
        -- 关键：如果玩家在该来源类型没有产出(JOIN为NULL)，则填充为 0
        COALESCE(a.reward_coin, 0) AS padded_reward_coin,
        -- 计算金币/骰子比例，如果reward_coin为0，ratio也为0
        CAST(COALESCE(a.reward_coin, 0) / p.cost_dice AS INT) AS coin_dice_ratio
    FROM
        all_players AS p
    CROSS JOIN
        all_relevant_source_types AS s
    LEFT JOIN
        actual_coin_output AS a
        ON p.day = a.day
        AND p.proj_simple_game_id = a.proj_simple_game_id
        AND s.proj_asset_source_type = a.proj_asset_source_type
)

-- 步骤5: 在补0后的全量数据上计算分位数（按日期和来源类型分组）
-- 现在每个 source_type 的分母都是 'all_players' 的总数
-- proj_asset_source_type 说明：1 棋盘、5 活动、6 钓鱼
SELECT
    CASE 
        WHEN CAST(proj_asset_source_type AS INT) = 1 THEN '棋盘'
        WHEN CAST(proj_asset_source_type AS INT) = 5 THEN '活动'
        WHEN CAST(proj_asset_source_type AS INT) = 6 THEN '钓鱼'
        ELSE '未知'
    END AS source_type_name,  -- 来源类型中文说明
    proj_asset_source_type,
    day,  -- 日期维度
    COUNT(proj_simple_game_id) AS user_count,  -- 用户数
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY coin_dice_ratio ASC), 0) AS p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY coin_dice_ratio ASC), 0) AS p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY coin_dice_ratio ASC), 0) AS p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY coin_dice_ratio ASC), 0) AS p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY coin_dice_ratio ASC), 0) AS p95
FROM
    padded_data
GROUP BY
    day,
    proj_asset_source_type
ORDER BY
    proj_asset_source_type,
    day
