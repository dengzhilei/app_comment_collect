/*
proj_asset_source_type  说明：1 棋盘、2 充值、3 建造、4 卡册、5 活动、6钓鱼、7 其他零碎、  其他的未知）
 * 步骤1: 定义“全量玩家”
 * 我们假设“全量玩家”指代在 ${PartDate:date1} 这一天有任何事件的所有玩家 (DAU)
 */
WITH all_players AS (
    SELECT DISTINCT
        proj_simple_game_id
    FROM
        table.event_20652  -- 替换为您的表名
    WHERE
    	event_id='CS_ENTER_GAME'
        and day ${PartDate:date1}
  		and cast(proj_level as int)>=2
),

/*
 * 步骤2: 计算 resource_id = '100100' 的实际产出总和
 * (这基本是您原来的 CTE，只是重命名了)
 */
actual_output AS (
    SELECT
  		proj_simple_game_id,
        proj_asset_source_type,
  		proj_asset_change_type,
        SUM(cast(proj_asset_value as int)) AS total_output
    FROM
        table.event_20652   -- 替换为您的表名
    WHERE
        event_id='asset_circulate'
      	and day ${PartDate:date1}
        and cast(proj_asset_id as int) = ${Variable1} -- 输入动态参数
  		and cast(proj_level as int)>=2
    GROUP BY
  		proj_simple_game_id,
        proj_asset_source_type,
  		proj_asset_change_type
  		
),

/*
 * 步骤3: 获取所有相关的来源类型
 * (即所有产出过 '100100' 的来源)
 */
all_relevant_sources AS (
    SELECT DISTINCT
        proj_asset_source_type,
  		proj_asset_change_type
    FROM
        actual_output
),

/*
 * 步骤4: 创建“全量矩阵” (所有玩家 x 所有来源) 并用 0 填充缺失的产出
 */
padded_data AS (
    SELECT
        p.proj_simple_game_id,
        s.proj_asset_source_type,
  		s.proj_asset_change_type,
        -- 关键：如果玩家在该来源没有产出(JOIN为NULL)，则填充为 0
        COALESCE(a.total_output, 0) AS padded_total_output
    FROM
        all_players AS p
    CROSS JOIN
        all_relevant_sources AS s
    LEFT JOIN
        actual_output AS a
        ON p.proj_simple_game_id = a.proj_simple_game_id
        AND s.proj_asset_source_type = a.proj_asset_source_type
        AND s.proj_asset_change_type = a.proj_asset_change_type
)



/*
 * 最终步骤: 在补0后的全量数据上计算P75, P90, P95, P99
 * 现在每个 source_type 的分母都是 'all_players' 的总数
 */
SELECT
	proj_asset_change_type,
    proj_asset_source_type,
    CASE 
        WHEN CAST(proj_asset_source_type AS INT) = 1 THEN '棋盘'
        WHEN CAST(proj_asset_source_type AS INT) = 2 THEN '充值'
        WHEN CAST(proj_asset_source_type AS INT) = 3 THEN '建造'
        WHEN CAST(proj_asset_source_type AS INT) = 4 THEN '卡册'
        WHEN CAST(proj_asset_source_type AS INT) = 5 THEN '活动'
        WHEN CAST(proj_asset_source_type AS INT) = 6 THEN '钓鱼'
        WHEN CAST(proj_asset_source_type AS INT) = 7 THEN '其他零碎'
        ELSE '未知'
    END AS source_type_name,  -- 来源类型中文说明
    COUNT(proj_simple_game_id) AS user_count,  -- 用户数
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY padded_total_output ASC), 0) AS p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY padded_total_output ASC), 0) AS p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY padded_total_output ASC), 0) AS p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY padded_total_output ASC), 0) AS p95,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY padded_total_output ASC), 0) AS p99,
    ROUND(PERCENTILE_CONT(0.999) WITHIN GROUP (ORDER BY padded_total_output ASC), 0) AS p999
FROM
    padded_data
GROUP BY
    proj_asset_source_type,
    proj_asset_change_type
ORDER by p90 DESC;