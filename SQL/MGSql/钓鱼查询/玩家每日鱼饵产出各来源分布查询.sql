/* 查询各来源每日产出的各档分位数，要注意用全集*/

-- 步骤1: 定义"全量玩家"（全体用户，即DAU）
WITH all_players AS (
    SELECT DISTINCT
        day,
        proj_simple_game_id
    FROM
        table.event_20652
    WHERE
        event_id = 'CS_ENTER_GAME'  -- 进入游戏事件，代表活跃用户
        AND day ${PartDate:date1}
        AND CAST(proj_level AS numeric) >= 3  -- 等级过滤
),

-- 步骤2: 计算实际的鱼饵产出（按来源）
actual_bait_output AS (
    SELECT
        day,
        proj_simple_game_id,
        proj_asset_source,
        SUM(CAST(proj_asset_value AS BIGINT)) AS total_output_bait
    FROM
        table.event_20652
    WHERE
        event_id = 'asset_circulate'
        AND day ${PartDate:date1}
        AND proj_asset_id = '100600'  -- 鱼饵ID
        AND CAST(proj_level AS numeric) >= 3
        AND proj_asset_change_type = '1'  -- 产出类型
    GROUP BY
        day,
        proj_simple_game_id,
        proj_asset_source
),

-- 步骤3: 获取所有相关的来源类型
all_relevant_sources AS (
    SELECT DISTINCT
        day,
        proj_asset_source
    FROM
        actual_bait_output
),

-- 步骤4: 创建"全量矩阵" (所有玩家 x 所有来源) 并用 0 填充缺失的产出
padded_data AS (
    SELECT
        p.day,
        p.proj_simple_game_id,
        s.proj_asset_source,
        -- 关键：如果玩家在该来源没有产出(JOIN为NULL)，则填充为 0
        COALESCE(a.total_output_bait, 0) AS padded_total_output_bait
    FROM
        all_players AS p
    INNER JOIN
        all_relevant_sources AS s
        ON p.day = s.day
    LEFT JOIN
        actual_bait_output AS a
        ON p.day = a.day
        AND p.proj_simple_game_id = a.proj_simple_game_id
        AND s.proj_asset_source = a.proj_asset_source
)

-- 步骤5: 在补0后的全量数据上计算各档分位数
SELECT
    day,
    proj_asset_source AS bait_source,
    COUNT(proj_simple_game_id) AS total_players,  -- 总玩家数（包括产出为0的）
    COUNT(CASE WHEN padded_total_output_bait > 0 THEN proj_simple_game_id END) AS players_with_output,  -- 有产出的玩家数
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY padded_total_output_bait ASC), 0) AS p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY padded_total_output_bait ASC), 0) AS p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY padded_total_output_bait ASC), 0) AS p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY padded_total_output_bait ASC), 0) AS p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY padded_total_output_bait ASC), 0) AS p95,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY padded_total_output_bait ASC), 0) AS p99,
    ROUND(AVG(padded_total_output_bait), 0) AS avg_output,  -- 平均产出
    ROUND(MAX(padded_total_output_bait), 0) AS max_output   -- 最大产出
FROM
    padded_data
GROUP BY
    day,
    proj_asset_source
ORDER BY
    day,
    proj_asset_source;
