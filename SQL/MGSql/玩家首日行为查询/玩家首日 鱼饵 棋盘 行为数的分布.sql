-- 1. 找出指定注册日期的用户 (我们的分析队列)
WITH NewUsers AS (
    SELECT
        user_id,
        date(to_timestamp(cast(create_time as BIGINT)/1000)) AS reg_date
    FROM
        table.user_20652
    WHERE
        -- [!] 请在这里设定您要统计的新用户注册周期
        date(to_timestamp(cast(create_time as BIGINT)/1000)) ${PartDate:date1}

),

-- 2. 获取这些用户首日(Day 0)的花费数据
FirstDayBaitConsumption AS (
    SELECT
        nu.user_id,
        nu.reg_date,
        -- 计算首日花费的鱼饵总数
        COALESCE(SUM(CASE WHEN e.proj_asset_id = '100600' AND e.proj_asset_change_type = '2' THEN CAST(e.proj_asset_value AS BIGINT) ELSE 0 END), 0) AS day0_total_cost_bait,
        -- 计算首日花费的骰子总数
        COALESCE(SUM(CASE WHEN e.proj_asset_id = '100100' AND e.proj_asset_change_type = '2' THEN CAST(e.proj_asset_value AS BIGINT) ELSE 0 END), 0) AS day0_total_cost_dice,
        -- 计算首日棋盘掷骰子次数（每次消耗骰子为1次，proj_asset_source_type = 1 表示棋盘）
        COALESCE(COUNT(CASE WHEN e.proj_asset_id = '100100' AND e.proj_asset_change_type = '2' AND CAST(e.proj_asset_source_type AS INT) = 1 THEN 1 END), 0) AS day0_board_dice_count
    FROM
        NewUsers nu
    LEFT JOIN
        table.event_20652 e
        ON nu.user_id = e.user_id
        AND e.event_id = 'asset_circulate'
        -- 关键：首日 = 注册当天
        AND e.day = nu.reg_date
    GROUP BY
        nu.user_id,
        nu.reg_date
),

-- 3. 按注册日期分组，一次性计算所有指标的分位数（只扫描一次表，性能最优）
percentiles AS (
    SELECT
        reg_date,  -- 注册日期维度
        COUNT(user_id) AS user_count,
        -- 鱼饵消耗
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY day0_total_cost_bait ASC), 0) AS bait_p25,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY day0_total_cost_bait ASC), 0) AS bait_p50,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY day0_total_cost_bait ASC), 0) AS bait_p75,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY day0_total_cost_bait ASC), 0) AS bait_p90,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY day0_total_cost_bait ASC), 0) AS bait_p95,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY day0_total_cost_bait ASC), 0) AS bait_p99,
        ROUND(AVG(day0_total_cost_bait), 0) AS bait_avg,
        ROUND(MAX(day0_total_cost_bait), 0) AS bait_max,
        -- 骰子花费
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY day0_total_cost_dice ASC), 0) AS dice_p25,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY day0_total_cost_dice ASC), 0) AS dice_p50,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY day0_total_cost_dice ASC), 0) AS dice_p75,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY day0_total_cost_dice ASC), 0) AS dice_p90,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY day0_total_cost_dice ASC), 0) AS dice_p95,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY day0_total_cost_dice ASC), 0) AS dice_p99,
        ROUND(AVG(day0_total_cost_dice), 0) AS dice_avg,
        ROUND(MAX(day0_total_cost_dice), 0) AS dice_max,
        -- 棋盘掷骰子次数
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY day0_board_dice_count ASC), 0) AS board_p25,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY day0_board_dice_count ASC), 0) AS board_p50,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY day0_board_dice_count ASC), 0) AS board_p75,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY day0_board_dice_count ASC), 0) AS board_p90,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY day0_board_dice_count ASC), 0) AS board_p95,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY day0_board_dice_count ASC), 0) AS board_p99,
        ROUND(AVG(day0_board_dice_count), 0) AS board_avg,
        ROUND(MAX(day0_board_dice_count), 0) AS board_max
    FROM
        FirstDayBaitConsumption
    GROUP BY
        reg_date
)

-- 4. 将三个指标作为三行输出（只做列选择，无重复计算）
SELECT '鱼饵消耗' AS metric_name, reg_date, user_count, bait_p25 AS p25, bait_p50 AS p50, bait_p75 AS p75, bait_p90 AS p90, bait_p95 AS p95, bait_p99 AS p99, bait_avg AS avg_value, bait_max AS max_value FROM percentiles
UNION ALL
SELECT '骰子花费' AS metric_name, reg_date, user_count, dice_p25 AS p25, dice_p50 AS p50, dice_p75 AS p75, dice_p90 AS p90, dice_p95 AS p95, dice_p99 AS p99, dice_avg AS avg_value, dice_max AS max_value FROM percentiles
UNION ALL
SELECT '棋盘掷骰子次数' AS metric_name, reg_date, user_count, board_p25 AS p25, board_p50 AS p50, board_p75 AS p75, board_p90 AS p90, board_p95 AS p95, board_p99 AS p99, board_avg AS avg_value, board_max AS max_value FROM percentiles
ORDER BY metric_name,reg_date;

