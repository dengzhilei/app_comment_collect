/*
按注册天数聚类，查看不同注册天数段的玩家，骰子余量和鱼饵余量的分位数分布
统计方式：每天的行为数据标记"当天是注册第几天"，取每天最后一条记录的余量，然后按注册天数聚类汇总
例如：所有玩家在"注册第1天"的骰子余量分位数、所有玩家在"注册第2天"的鱼饵余量分位数等
*/

-- 1. 获取指定注册时间段的用户，并计算注册日期
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

-- 2. 获取每天每个玩家的所有金流记录，并标记当天是注册第几天
DailyAssetRecords AS (
    SELECT
        e.user_id,
        e.day AS behavior_date,
        nu.reg_date,
        -- 计算当天是注册第几天（注册当天为第0天）
        DATEDIFF(e.day, nu.reg_date) AS reg_day,
        -- 骰子余量
        CAST(e.proj_dice AS BIGINT) AS dice_balance,
        -- 鱼饵余量
        CAST(e.proj_bait_num AS BIGINT) AS bait_balance,
        -- 时间戳（用于排序，优先使用proj_action_bg_time，如果为空则使用event_time）
        COALESCE(NULLIF(CAST(e.proj_action_bg_time AS BIGINT), 0), e.event_time) AS record_time
    FROM
        table.event_20652 e
    INNER JOIN
        NewUsers nu
        ON e.user_id = nu.user_id
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围（玩家行为统计期间）
        AND e.day ${PartDate:date2}
        AND DATEDIFF(e.day, nu.reg_date) >= 0  -- 确保行为日期不早于注册日期
        AND (e.proj_dice IS NOT NULL OR e.proj_bait_num IS NOT NULL)  -- 至少有一个余量字段不为空
),

-- 3. 获取每天每个玩家的最后一条记录（按时间排序），取该记录的余量
DailyLastBalance AS (
    SELECT
        user_id,
        behavior_date,
        reg_day,
        dice_balance,
        bait_balance,
        ROW_NUMBER() OVER (PARTITION BY user_id, behavior_date ORDER BY record_time DESC) AS rn
    FROM
        DailyAssetRecords
),

-- 4. 提取每天每个玩家的最后一条记录的余量
DailyBalanceStats AS (
    SELECT
        user_id,
        behavior_date,
        reg_day,
        COALESCE(dice_balance, 0) AS daily_dice_balance,
        COALESCE(bait_balance, 0) AS daily_bait_balance
    FROM
        DailyLastBalance
    WHERE
        rn = 1
),

-- 5. 按注册天数聚类
RegDaysClustered AS (
    SELECT
        user_id,
        behavior_date,
        reg_day,
        daily_dice_balance,
        daily_bait_balance,
        -- 注册天数聚类规则：0-7天细分，8-14天、15-30天、31-60天、61-90天、91+天
        CASE
            WHEN reg_day = 0 THEN '0天'
            WHEN reg_day = 1 THEN '1天'
            WHEN reg_day BETWEEN 2 AND 3 THEN '2-3天'
            WHEN reg_day BETWEEN 4 AND 7 THEN '4-7天'
            WHEN reg_day BETWEEN 8 AND 14 THEN '8-14天'
            WHEN reg_day BETWEEN 15 AND 30 THEN '15-30天'
            WHEN reg_day BETWEEN 31 AND 60 THEN '31-60天'
            WHEN reg_day BETWEEN 61 AND 90 THEN '61-90天'
            WHEN reg_day >= 91 THEN '91+天'
            ELSE '未知'
        END AS reg_days_group
    FROM
        DailyBalanceStats
)

-- 6. 按注册天数聚类分组，计算每天骰子余量和鱼饵余量的分位数分布
SELECT
    reg_days_group AS reg_days_range,  -- 注册天数范围聚类
    COUNT(*) AS day_count,  -- 总天数（所有玩家在该注册天数段的总天数）
    COUNT(DISTINCT user_id) AS user_count,  -- 参与该注册天数段的玩家数
    -- 每天骰子余量分位数（所有玩家在该注册天数段的每天骰子余量）
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY daily_dice_balance ASC), 0) AS daily_dice_balance_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY daily_dice_balance ASC), 0) AS daily_dice_balance_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY daily_dice_balance ASC), 0) AS daily_dice_balance_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY daily_dice_balance ASC), 0) AS daily_dice_balance_p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY daily_dice_balance ASC), 0) AS daily_dice_balance_p95,
    -- 每天鱼饵余量分位数（所有玩家在该注册天数段的每天鱼饵余量）
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY daily_bait_balance ASC), 0) AS daily_bait_balance_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY daily_bait_balance ASC), 0) AS daily_bait_balance_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY daily_bait_balance ASC), 0) AS daily_bait_balance_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY daily_bait_balance ASC), 0) AS daily_bait_balance_p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY daily_bait_balance ASC), 0) AS daily_bait_balance_p95
FROM
    RegDaysClustered
GROUP BY
    reg_days_group
ORDER BY
    MIN(reg_day);

