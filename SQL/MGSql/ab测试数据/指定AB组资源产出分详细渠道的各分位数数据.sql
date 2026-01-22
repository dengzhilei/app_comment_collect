/*
指定AB测试分组资源产出分详细渠道的各分位数数据

AB测试分组规则：
- A1组：proj_ab_bucket_1 在 101-200
- A2组：proj_ab_bucket_2 在 101-200
- B1组：proj_ab_bucket_1 在 1-100
- B2组：proj_ab_bucket_2 在 1-100

补充需求，针对 proj_asset_source=C_PROGRESS_REWARD 的类型
这是一个大类，包含各种活动的进度条的奖励，
此类产出需要再进行拆分，拆分依据为 proj_activity_type 这个字段的不同的值。
其他类型的奖励不需要 按proj_activity_type 这个字段进行拆分

另外，proj_activity_type 字段的值有以下几种：
1001：全局进度条
2001：锦标赛
3xxx: 小游戏
8001：鱼饵进度条
其余： 显示原来的id
按照上述规则显示 说明结果，而不是原来的值
*/

/*
 * 步骤1: 获取指定AB测试分组的玩家信息
 */
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
            CAST(proj_ab_bucket_2 AS INT) BETWEEN 101 AND 200
            -- A2组
            -- CAST(proj_ab_bucket_2 AS INT) BETWEEN 101 AND 200
            -- B1组
            -- CAST(proj_ab_bucket_1 AS INT) BETWEEN 1 AND 100
            -- B2组
            -- CAST(proj_ab_bucket_2 AS INT) BETWEEN 1 AND 100
        )
),

/*
 * 步骤2: 定义"全量玩家"（指定AB组中在指定日期有事件的玩家）
 * 我们假设"全量玩家"指代在 ${PartDate:date1} 这一天有任何事件的所有玩家 (DAU)
 */
all_players AS (
    SELECT DISTINCT
        e.proj_simple_game_id
    FROM
        table.event_20652 e
    INNER JOIN
        ABGroupUsers abu
        ON e.proj_simple_game_id = abu.user_id
    WHERE
        e.event_id = 'CS_ENTER_GAME'
        AND e.day ${PartDate:date1}
        AND CAST(e.proj_level AS INT) >= 2
),

/*
 * 步骤3: 计算 resource_id 的实际产出总和（仅限指定AB组的玩家）
 * 对于 C_PROGRESS_REWARD 类型，需要按 proj_activity_type 进一步拆分
 */
actual_output AS (
    SELECT
        e.proj_simple_game_id,
        e.proj_asset_source,
        e.proj_asset_change_type,
        -- 对于 C_PROGRESS_REWARD 类型，使用 proj_activity_type 作为拆分依据；其他类型使用 NULL
        CASE 
            WHEN e.proj_asset_source = 'C_PROGRESS_REWARD' THEN e.proj_activity_type
            ELSE NULL
        END AS proj_activity_type,
        SUM(CAST(e.proj_asset_value AS INT)) AS total_output
    FROM
        table.event_20652 e
    INNER JOIN
        ABGroupUsers abu
        ON e.proj_simple_game_id = abu.user_id
    WHERE
        e.event_id = 'asset_circulate'
        AND e.day ${PartDate:date1}
        AND CAST(e.proj_asset_id AS INT) = ${Variable1}  -- 输入动态参数
        AND CAST(e.proj_level AS INT) >= 2
    GROUP BY
        e.proj_simple_game_id,
        e.proj_asset_source,
        e.proj_asset_change_type,
        CASE 
            WHEN e.proj_asset_source = 'C_PROGRESS_REWARD' THEN e.proj_activity_type
            ELSE NULL
        END
),

/*
 * 步骤4: 获取所有相关的来源类型
 * (即所有产出过该资源的来源，包含 proj_activity_type 信息)
 */
all_relevant_sources AS (
    SELECT DISTINCT
        proj_asset_source,
        proj_asset_change_type,
        proj_activity_type
    FROM
        actual_output
),

/*
 * 步骤5: 创建"全量矩阵" (所有玩家 x 所有来源) 并用 0 填充缺失的产出
 */
padded_data AS (
    SELECT
        p.proj_simple_game_id,
        s.proj_asset_source,
        s.proj_asset_change_type,
        s.proj_activity_type,
        -- 关键：如果玩家在该来源没有产出(JOIN为NULL)，则填充为 0
        COALESCE(a.total_output, 0) AS padded_total_output
    FROM
        all_players AS p
    CROSS JOIN
        all_relevant_sources AS s
    LEFT JOIN
        actual_output AS a
        ON p.proj_simple_game_id = a.proj_simple_game_id
        AND s.proj_asset_source = a.proj_asset_source
        AND s.proj_asset_change_type = a.proj_asset_change_type
        AND COALESCE(s.proj_activity_type, '') = COALESCE(a.proj_activity_type, '')
),

/*
 * 步骤6: 对 proj_activity_type 进行转换显示
 * 1001显示为"全局进度条"，2001显示为"锦标赛"，3xxx显示为"小游戏"，其余显示原值
 */
padded_data_with_display AS (
    SELECT
        proj_simple_game_id,
        proj_asset_source,
        proj_asset_change_type,
        padded_total_output,
        -- 对 proj_activity_type 进行转换显示
        -- 1001显示为"全局进度条"，2001显示为"锦标赛"，3xxx显示为"小游戏"，其余显示原值
        CASE 
            WHEN CAST(proj_activity_type AS STRING) = '1001' THEN '全局进度条'
            WHEN CAST(proj_activity_type AS STRING) = '2001' THEN '锦标赛'
            WHEN CAST(proj_activity_type AS STRING) = '8001' THEN '鱼饵进度条'
            WHEN proj_activity_type IS NOT NULL AND CAST(proj_activity_type AS STRING) LIKE '3%' THEN '小游戏'
            ELSE CAST(proj_activity_type AS STRING)
        END AS proj_activity_type_display
    FROM
        padded_data
)

/*
 * 最终步骤: 在补0后的全量数据上计算P50, P75, P90, P95, P99, P999
 * 现在每个 source_type 的分母都是指定AB组中 'all_players' 的总数
 * 对于 C_PROGRESS_REWARD 类型，会按 proj_activity_type 进行拆分统计
 * 对 proj_activity_type 进行转换显示：1001显示为"全局进度条"，2001显示为"锦标赛"，3xxx显示为"小游戏"，其余显示原值
 */
SELECT
    proj_asset_change_type,
    proj_asset_source,
    proj_activity_type_display AS proj_activity_type,  -- 对于 C_PROGRESS_REWARD 类型，显示转换后的 proj_activity_type；其他类型为 NULL
    COUNT(proj_simple_game_id) AS user_count,  -- 用户数
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY padded_total_output ASC), 0) AS p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY padded_total_output ASC), 0) AS p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY padded_total_output ASC), 0) AS p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY padded_total_output ASC), 0) AS p95,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY padded_total_output ASC), 0) AS p99,
    ROUND(PERCENTILE_CONT(0.999) WITHIN GROUP (ORDER BY padded_total_output ASC), 0) AS p999
FROM
    padded_data_with_display
GROUP BY
    proj_asset_source,
    proj_asset_change_type,
    proj_activity_type_display
ORDER BY
    p90 DESC;

