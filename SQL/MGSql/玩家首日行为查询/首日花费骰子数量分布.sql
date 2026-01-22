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

-- 2. 获取这些用户首日(Day 0)花费的骰子数量
FirstDayDiceConsumption AS (
    SELECT
        nu.user_id,
        nu.reg_date,
        -- 计算首日花费的骰子总数
        COALESCE(SUM(CAST(e.proj_asset_value AS BIGINT)), 0) AS day0_total_cost_dice
    FROM
        NewUsers nu
    LEFT JOIN
        table.event_20652 e
        ON nu.user_id = e.user_id
        AND e.event_id = 'asset_circulate'
        AND e.proj_asset_id = '100100'  -- 骰子ID
        AND e.proj_asset_change_type = '2'  -- 消耗类型
        -- 关键：首日 = 注册当天
        AND e.day = nu.reg_date
    GROUP BY
        nu.user_id,
        nu.reg_date
)

-- 3. 最终聚合：按骰子消耗数量分桶统计分布
SELECT
    CASE
        WHEN day0_total_cost_dice = 0 THEN '01. (0)'
        WHEN day0_total_cost_dice BETWEEN 1 AND 50 THEN '02. (1 - 50)'
        WHEN day0_total_cost_dice BETWEEN 51 AND 100 THEN '03. (51 - 100)'
        WHEN day0_total_cost_dice BETWEEN 101 AND 200 THEN '04. (101 - 200)'
        WHEN day0_total_cost_dice BETWEEN 201 AND 500 THEN '05. (201 - 500)'
        WHEN day0_total_cost_dice BETWEEN 501 AND 1000 THEN '06. (501 - 1000)'
        WHEN day0_total_cost_dice BETWEEN 1001 AND 2000 THEN '07. (1001 - 2000)'
        WHEN day0_total_cost_dice > 2000 THEN '08. (> 2000)'
        ELSE '00. (NULL)'
    END AS dice_cost_range,
    
    COUNT(user_id) AS user_count,
    ROUND(COUNT(user_id) * 100.0 / SUM(COUNT(user_id)) OVER (), 2) AS percentage,
    ROUND(AVG(day0_total_cost_dice), 0) AS avg_cost_in_range,
    ROUND(MAX(day0_total_cost_dice), 0) AS max_cost_in_range
FROM
    FirstDayDiceConsumption
GROUP BY
    dice_cost_range
ORDER BY
    dice_cost_range;

