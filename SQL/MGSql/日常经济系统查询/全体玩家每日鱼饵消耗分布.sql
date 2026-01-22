-- 1. 获取全体玩家每日的鱼饵消耗数据
WITH DailyBaitConsumption AS (
    SELECT
        e.user_id,
        e.day AS stat_date,
        -- 计算每日花费的鱼饵总数
        COALESCE(SUM(CASE WHEN e.proj_asset_id = '100600' AND e.proj_asset_change_type = '2' THEN CAST(e.proj_asset_value AS BIGINT) ELSE 0 END), 0) AS daily_total_cost_bait
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

-- 2. 按日期分组，计算鱼饵消耗的分位数
percentiles AS (
    SELECT
        stat_date,  -- 统计日期维度
        COUNT(user_id) AS user_count,
        -- 鱼饵消耗
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY daily_total_cost_bait ASC), 0) AS bait_p25,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY daily_total_cost_bait ASC), 0) AS bait_p50,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY daily_total_cost_bait ASC), 0) AS bait_p75,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY daily_total_cost_bait ASC), 0) AS bait_p90,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY daily_total_cost_bait ASC), 0) AS bait_p95,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY daily_total_cost_bait ASC), 0) AS bait_p99
    FROM
        DailyBaitConsumption
    GROUP BY
        stat_date
)

-- 3. 输出鱼饵消耗统计结果
SELECT 
    stat_date, 
    user_count, 
    bait_p25 AS p25, 
    bait_p50 AS p50, 
    bait_p75 AS p75, 
    bait_p90 AS p90, 
    bait_p95 AS p95, 
    bait_p99 AS p99
FROM percentiles
ORDER BY stat_date;

