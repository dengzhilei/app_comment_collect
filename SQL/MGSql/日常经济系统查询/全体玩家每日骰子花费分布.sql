-- 1. 获取全体玩家每日的骰子花费数据
WITH DailyDiceConsumption AS (
    SELECT
        e.user_id,
        e.day AS stat_date,
        -- 计算每日花费的骰子总数
        COALESCE(SUM(CASE WHEN e.proj_asset_id = '100100' AND e.proj_asset_change_type = '2' THEN CAST(e.proj_asset_value AS BIGINT) ELSE 0 END), 0) AS daily_total_cost_dice
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
    GROUP BY
        e.user_id,
        e.day
),

-- 2. 按日期分组，计算骰子花费的分位数
percentiles AS (
    SELECT
        stat_date,  -- 统计日期维度
        COUNT(user_id) AS user_count,
        -- 骰子花费
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY daily_total_cost_dice ASC), 0) AS dice_p25,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY daily_total_cost_dice ASC), 0) AS dice_p50,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY daily_total_cost_dice ASC), 0) AS dice_p75,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY daily_total_cost_dice ASC), 0) AS dice_p90,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY daily_total_cost_dice ASC), 0) AS dice_p95,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY daily_total_cost_dice ASC), 0) AS dice_p99
    FROM
        DailyDiceConsumption
    GROUP BY
        stat_date
)

-- 3. 输出骰子花费统计结果
SELECT 
    stat_date, 
    user_count, 
    dice_p25 AS p25, 
    dice_p50 AS p50, 
    dice_p75 AS p75, 
    dice_p90 AS p90, 
    dice_p95 AS p95, 
    dice_p99 AS p99
FROM percentiles
ORDER BY stat_date;

