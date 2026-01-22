/*
 * 玩家每日产出和消耗鱼饵数量分布查询
 * 统计指定日期范围内，每个玩家每天的鱼饵产出和消耗数量分布
 */

-- 步骤1: 计算每个玩家每天的鱼饵产出和消耗
WITH daily_bait_stats AS (
    SELECT
        day,
        proj_simple_game_id,
        -- 产出数量（proj_asset_change_type = '1'）
        COALESCE(SUM(CASE WHEN proj_asset_change_type = '1' THEN CAST(proj_asset_value AS BIGINT) ELSE 0 END), 0) AS total_output_bait,
        -- 消耗数量（proj_asset_change_type = '2'）
        COALESCE(SUM(CASE WHEN proj_asset_change_type = '2' THEN CAST(proj_asset_value AS BIGINT) ELSE 0 END), 0) AS total_cost_bait
    FROM
        table.event_20652
    WHERE
        event_id = 'asset_circulate'
        AND day ${PartDate:date1}
        AND proj_asset_id = '100600'  -- 鱼饵ID
        AND CAST(proj_level AS numeric) >= 3  -- 等级过滤
    GROUP BY
        day,
        proj_simple_game_id
)

-- 步骤2: 按产出数量分桶统计分布
SELECT
    day,
    '产出' AS change_type,
    CASE
        WHEN total_output_bait = 0 THEN '01. (0)'
        WHEN total_output_bait BETWEEN 1 AND 10 THEN '02. (1 - 10)'
        WHEN total_output_bait BETWEEN 11 AND 50 THEN '03. (11 - 50)'
        WHEN total_output_bait BETWEEN 51 AND 100 THEN '04. (51 - 100)'
        WHEN total_output_bait BETWEEN 101 AND 200 THEN '05. (101 - 200)'
        WHEN total_output_bait BETWEEN 201 AND 500 THEN '06. (201 - 500)'
        WHEN total_output_bait > 500 THEN '07. (> 500)'
        ELSE '00. (NULL)'
    END AS bait_range,
    COUNT(proj_simple_game_id) AS player_count,
    ROUND(COUNT(proj_simple_game_id) * 100.0 / SUM(COUNT(proj_simple_game_id)) OVER (PARTITION BY day), 2) AS percentage,
    ROUND(AVG(total_output_bait), 0) AS avg_amount_in_range,
    ROUND(MAX(total_output_bait), 0) AS max_amount_in_range
FROM
    daily_bait_stats
GROUP BY
    day,
    bait_range

UNION ALL

-- 步骤3: 按消耗数量分桶统计分布
SELECT
    day,
    '消耗' AS change_type,
    CASE
        WHEN total_cost_bait = 0 THEN '01. (0)'
        WHEN total_cost_bait BETWEEN 1 AND 10 THEN '02. (1 - 10)'
        WHEN total_cost_bait BETWEEN 11 AND 50 THEN '03. (11 - 50)'
        WHEN total_cost_bait BETWEEN 51 AND 100 THEN '04. (51 - 100)'
        WHEN total_cost_bait BETWEEN 101 AND 200 THEN '05. (101 - 200)'
        WHEN total_cost_bait BETWEEN 201 AND 500 THEN '06. (201 - 500)'
        WHEN total_cost_bait > 500 THEN '07. (> 500)'
        ELSE '00. (NULL)'
    END AS bait_range,
    COUNT(proj_simple_game_id) AS player_count,
    ROUND(COUNT(proj_simple_game_id) * 100.0 / SUM(COUNT(proj_simple_game_id)) OVER (PARTITION BY day), 2) AS percentage,
    ROUND(AVG(total_cost_bait), 0) AS avg_amount_in_range,
    ROUND(MAX(total_cost_bait), 0) AS max_amount_in_range
FROM
    daily_bait_stats
GROUP BY
    day,
    bait_range

ORDER BY
    day,
    change_type,
    bait_range;

