/*
用当日最后一条金流日志作为最终余量
鱼饵和骰子余量都是通用字段，在每条日志里都有
金币余量需要除以膨胀系数（proj_reward_coin_multi）
最终输出分位数
*/

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
        and cast(proj_level as int)>=2
),

-- 2. 获取这些用户首日(Day 0)最后一条金流日志的鱼饵、骰子和金币余量
FirstDayLastLog AS (
    SELECT
        nu.user_id,
        nu.reg_date,
        CAST(rl.proj_bait_num AS BIGINT) AS day0_bait_balance,  -- 鱼饵余量
        CAST(rl.proj_dice AS BIGINT) AS day0_dice_balance,   -- 骰子余量
        CAST(CAST(rl.proj_coin AS BIGINT) / CAST(rl.proj_reward_coin_multi AS INT) AS BIGINT) AS day0_coin_balance  -- 金币余量（除以膨胀系数）
    FROM
        NewUsers nu
    LEFT JOIN
        (
            -- 找到每个用户首日最后一条金流日志
            SELECT
                e.user_id,
                e.day,
                e.proj_bait_num,
                e.proj_dice,
                e.proj_coin,
                e.proj_reward_coin_multi,
                ROW_NUMBER() OVER(
                    PARTITION BY e.user_id, e.day
                    ORDER BY e.event_time DESC
                ) AS rn
            FROM
                table.event_20652 e
            WHERE
                e.event_id = 'asset_circulate'
                AND e.proj_bait_num IS NOT NULL  -- 确保鱼饵余量字段不为空
                AND e.proj_dice IS NOT NULL  -- 确保骰子余量字段不为空
                AND e.proj_coin IS NOT NULL  -- 确保金币余量字段不为空
                AND e.proj_reward_coin_multi IS NOT NULL  -- 确保膨胀系数字段不为空
                AND CAST(e.proj_reward_coin_multi AS INT) > 0  -- 确保膨胀系数大于0
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
        -- 鱼饵余量
        ROUND(PERCENTILE_CONT(0.20) WITHIN GROUP (ORDER BY day0_bait_balance ASC), 0) AS bait_p20,
        ROUND(PERCENTILE_CONT(0.30) WITHIN GROUP (ORDER BY day0_bait_balance ASC), 0) AS bait_p30,
        ROUND(PERCENTILE_CONT(0.40) WITHIN GROUP (ORDER BY day0_bait_balance ASC), 0) AS bait_p40,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY day0_bait_balance ASC), 0) AS bait_p50,
        ROUND(PERCENTILE_CONT(0.60) WITHIN GROUP (ORDER BY day0_bait_balance ASC), 0) AS bait_p60,
        ROUND(PERCENTILE_CONT(0.70) WITHIN GROUP (ORDER BY day0_bait_balance ASC), 0) AS bait_p70,
        ROUND(PERCENTILE_CONT(0.80) WITHIN GROUP (ORDER BY day0_bait_balance ASC), 0) AS bait_p80,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY day0_bait_balance ASC), 0) AS bait_p90,
        ROUND(AVG(day0_bait_balance), 0) AS bait_avg,
        ROUND(MAX(day0_bait_balance), 0) AS bait_max,
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
        -- 金币余量
        ROUND(PERCENTILE_CONT(0.20) WITHIN GROUP (ORDER BY day0_coin_balance ASC), 0) AS coin_p20,
        ROUND(PERCENTILE_CONT(0.30) WITHIN GROUP (ORDER BY day0_coin_balance ASC), 0) AS coin_p30,
        ROUND(PERCENTILE_CONT(0.40) WITHIN GROUP (ORDER BY day0_coin_balance ASC), 0) AS coin_p40,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY day0_coin_balance ASC), 0) AS coin_p50,
        ROUND(PERCENTILE_CONT(0.60) WITHIN GROUP (ORDER BY day0_coin_balance ASC), 0) AS coin_p60,
        ROUND(PERCENTILE_CONT(0.70) WITHIN GROUP (ORDER BY day0_coin_balance ASC), 0) AS coin_p70,
        ROUND(PERCENTILE_CONT(0.80) WITHIN GROUP (ORDER BY day0_coin_balance ASC), 0) AS coin_p80,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY day0_coin_balance ASC), 0) AS coin_p90,
        ROUND(AVG(day0_coin_balance), 0) AS coin_avg,
        ROUND(MAX(day0_coin_balance), 0) AS coin_max
    FROM
        FirstDayLastLog
    WHERE
        day0_bait_balance IS NOT NULL  -- 过滤掉没有余量数据的用户
        AND day0_dice_balance IS NOT NULL
        AND day0_coin_balance IS NOT NULL
    GROUP BY
        reg_date
)

-- 4. 将三个指标作为三行输出（只做列选择，无重复计算）
SELECT '鱼饵余量' AS metric_name, reg_date, user_count, bait_p20 AS p20, bait_p30 AS p30, bait_p40 AS p40, bait_p50 AS p50, bait_p60 AS p60, bait_p70 AS p70, bait_p80 AS p80, bait_p90 AS p90, bait_avg AS avg_value, bait_max AS max_value FROM percentiles
UNION ALL
SELECT '骰子余量' AS metric_name, reg_date, user_count, dice_p20 AS p20, dice_p30 AS p30, dice_p40 AS p40, dice_p50 AS p50, dice_p60 AS p60, dice_p70 AS p70, dice_p80 AS p80, dice_p90 AS p90, dice_avg AS avg_value, dice_max AS max_value FROM percentiles
UNION ALL
SELECT '金币余量' AS metric_name, reg_date, user_count, coin_p20 AS p20, coin_p30 AS p30, coin_p40 AS p40, coin_p50 AS p50, coin_p60 AS p60, coin_p70 AS p70, coin_p80 AS p80, coin_p90 AS p90, coin_avg AS avg_value, coin_max AS max_value FROM percentiles
ORDER BY metric_name, reg_date;
