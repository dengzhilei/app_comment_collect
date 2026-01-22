/*
查询首日用户骰子和钞票余量分布
用当日最后一条金流日志作为最终余量
骰子和钞票余量都是公共字段，在每条金流日志里都有
最终输出分位数
*/

-- 1. 找出指定注册日期的用户 (我们的分析队列)
WITH NewUsers AS (
    SELECT
        user_id,
        date(to_timestamp(cast(create_time as BIGINT)/1000)) AS reg_date
    FROM
        table.user_20688
    WHERE
        -- [!] 请在这里设定您要统计的新用户注册周期
        date(to_timestamp(cast(create_time as BIGINT)/1000)) ${PartDate:date1}
),

-- 2. 获取这些用户首日(Day 0)最后一条金流日志的骰子和钞票余量
FirstDayLastLog AS (
    SELECT
        nu.user_id,
        nu.reg_date,
        CAST(rl.proj_dice_amount AS BIGINT) AS day0_dice_balance,   -- 骰子余量
        CAST(rl.proj_cash_amount AS BIGINT) AS day0_cash_balance    -- 钞票余量
    FROM
        NewUsers nu
    LEFT JOIN
        (
            -- 找到每个用户首日最后一条金流日志
            SELECT
                e.user_id,
                e.day,
                e.proj_dice_amount,
                e.proj_cash_amount,
                ROW_NUMBER() OVER(
                    PARTITION BY e.user_id, e.day
                    ORDER BY e.event_time DESC
                ) AS rn
            FROM
                table.event_20688 e
            WHERE
                e.event_id = 'currency_change'
                AND e.proj_dice_amount IS NOT NULL  -- 确保骰子余量字段不为空
                AND e.proj_cash_amount IS NOT NULL  -- 确保钞票余量字段不为空
        ) rl
        ON nu.user_id = rl.user_id
        AND nu.reg_date = rl.day
        AND rl.rn = 1  -- 只取最后一条记录
),

-- 3. 按注册日期分组，一次性计算所有指标的分位数（只扫描一次表，性能最优）
percentiles AS (
    SELECT
        reg_date,  -- 注册日期维度
        COUNT(user_id) AS user_count,
        -- 骰子余量
        ROUND(PERCENTILE_CONT(0.20) WITHIN GROUP (ORDER BY day0_dice_balance ASC), 0) AS dice_p20,
        ROUND(PERCENTILE_CONT(0.30) WITHIN GROUP (ORDER BY day0_dice_balance ASC), 0) AS dice_p30,
        ROUND(PERCENTILE_CONT(0.40) WITHIN GROUP (ORDER BY day0_dice_balance ASC), 0) AS dice_p40,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY day0_dice_balance ASC), 0) AS dice_p50,
        ROUND(PERCENTILE_CONT(0.60) WITHIN GROUP (ORDER BY day0_dice_balance ASC), 0) AS dice_p60,
        ROUND(PERCENTILE_CONT(0.70) WITHIN GROUP (ORDER BY day0_dice_balance ASC), 0) AS dice_p70,
        ROUND(PERCENTILE_CONT(0.80) WITHIN GROUP (ORDER BY day0_dice_balance ASC), 0) AS dice_p80,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY day0_dice_balance ASC), 0) AS dice_p90,
        ROUND(AVG(day0_dice_balance), 0) AS dice_avg,
        ROUND(MAX(day0_dice_balance), 0) AS dice_max,
        -- 钞票余量
        ROUND(PERCENTILE_CONT(0.20) WITHIN GROUP (ORDER BY day0_cash_balance ASC), 0) AS cash_p20,
        ROUND(PERCENTILE_CONT(0.30) WITHIN GROUP (ORDER BY day0_cash_balance ASC), 0) AS cash_p30,
        ROUND(PERCENTILE_CONT(0.40) WITHIN GROUP (ORDER BY day0_cash_balance ASC), 0) AS cash_p40,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY day0_cash_balance ASC), 0) AS cash_p50,
        ROUND(PERCENTILE_CONT(0.60) WITHIN GROUP (ORDER BY day0_cash_balance ASC), 0) AS cash_p60,
        ROUND(PERCENTILE_CONT(0.70) WITHIN GROUP (ORDER BY day0_cash_balance ASC), 0) AS cash_p70,
        ROUND(PERCENTILE_CONT(0.80) WITHIN GROUP (ORDER BY day0_cash_balance ASC), 0) AS cash_p80,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY day0_cash_balance ASC), 0) AS cash_p90,
        ROUND(AVG(day0_cash_balance), 0) AS cash_avg,
        ROUND(MAX(day0_cash_balance), 0) AS cash_max
    FROM
        FirstDayLastLog
    WHERE
        day0_dice_balance IS NOT NULL  -- 过滤掉没有余量数据的用户
        AND day0_cash_balance IS NOT NULL
    GROUP BY
        reg_date
)

-- 4. 将两个指标作为两行输出（只做列选择，无重复计算）
SELECT '骰子余量' AS metric_name, reg_date, user_count, dice_p20 AS p20, dice_p30 AS p30, dice_p40 AS p40, dice_p50 AS p50, dice_p60 AS p60, dice_p70 AS p70, dice_p80 AS p80, dice_p90 AS p90, dice_avg AS avg_value, dice_max AS max_value FROM percentiles
UNION ALL
SELECT '钞票余量' AS metric_name, reg_date, user_count, cash_p20 AS p20, cash_p30 AS p30, cash_p40 AS p40, cash_p50 AS p50, cash_p60 AS p60, cash_p70 AS p70, cash_p80 AS p80, cash_p90 AS p90, cash_avg AS avg_value, cash_max AS max_value FROM percentiles
ORDER BY metric_name, reg_date;
