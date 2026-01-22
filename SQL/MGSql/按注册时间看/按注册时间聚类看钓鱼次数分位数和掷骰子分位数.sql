/*
按注册天数聚类，查看不同注册天数段的玩家，钓鱼次数和掷骰子次数的分位数分布
统计方式：每天的行为数据标记"当天是注册第几天"，然后按注册天数聚类汇总
例如：所有玩家在"注册第1天"的钓鱼次数分位数、所有玩家在"注册第2天"的钓鱼次数分位数等
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

-- 2. 计算每天每个玩家的钓鱼次数，并标记当天是注册第几天
DailyFishingCount AS (
    SELECT
        e.user_id,
        e.day AS behavior_date,
        nu.reg_date,
        -- 计算当天是注册第几天（注册当天为第0天）
        DATEDIFF(e.day, nu.reg_date) AS reg_day,
        COUNT(*) AS daily_fishing_count
    FROM
        table.event_20652 e
    INNER JOIN
        NewUsers nu
        ON e.user_id = nu.user_id
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围（玩家行为统计期间）
        AND e.day ${PartDate:date2}
        AND e.proj_asset_id = '100600'  -- 鱼饵
        AND e.proj_asset_change_type = '2'  -- 消耗
        AND CAST(e.proj_asset_source_type AS INT) = 6  -- 钓鱼
        AND DATEDIFF(e.day, nu.reg_date) >= 0  -- 确保行为日期不早于注册日期
    GROUP BY
        e.user_id,
        e.day,
        nu.reg_date
),

-- 3. 计算每天每个玩家的掷骰子次数，并标记当天是注册第几天
DailyDiceRollCount AS (
    SELECT
        e.user_id,
        e.day AS behavior_date,
        nu.reg_date,
        -- 计算当天是注册第几天（注册当天为第0天）
        DATEDIFF(e.day, nu.reg_date) AS reg_day,
        COUNT(*) AS daily_dice_roll_count
    FROM
        table.event_20652 e
    INNER JOIN
        NewUsers nu
        ON e.user_id = nu.user_id
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围（玩家行为统计期间）
        AND e.day ${PartDate:date2}
        AND e.proj_asset_id = '100100'  -- 骰子
        AND e.proj_asset_change_type = '2'  -- 消耗
        AND CAST(e.proj_asset_source_type AS INT) = 1  -- 棋盘掷骰子
        AND DATEDIFF(e.day, nu.reg_date) >= 0  -- 确保行为日期不早于注册日期
    GROUP BY
        e.user_id,
        e.day,
        nu.reg_date
),

-- 4. 合并每天的钓鱼和掷骰子数据（按用户+日期+注册天数）
DailyBehaviorStats AS (
    SELECT
        COALESCE(dfc.user_id, ddrc.user_id) AS user_id,
        COALESCE(dfc.behavior_date, ddrc.behavior_date) AS behavior_date,
        COALESCE(dfc.reg_day, ddrc.reg_day) AS reg_day,
        COALESCE(dfc.daily_fishing_count, 0) AS daily_fishing_count,
        COALESCE(ddrc.daily_dice_roll_count, 0) AS daily_dice_roll_count
    FROM
        DailyFishingCount dfc
    FULL OUTER JOIN
        DailyDiceRollCount ddrc
        ON dfc.user_id = ddrc.user_id
        AND dfc.behavior_date = ddrc.behavior_date
),

-- 5. 按注册天数聚类
RegDaysClustered AS (
    SELECT
        user_id,
        behavior_date,
        reg_day,
        daily_fishing_count,
        daily_dice_roll_count,
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
        DailyBehaviorStats
)

-- 6. 按注册天数聚类分组，计算每天钓鱼次数和掷骰子次数的分位数分布
SELECT
    reg_days_group AS reg_days_range,  -- 注册天数范围聚类
    COUNT(*) AS day_count,  -- 总天数（所有玩家在该注册天数段的总天数）
    COUNT(DISTINCT user_id) AS user_count,  -- 参与该注册天数段的玩家数
    -- 每天钓鱼次数分位数（所有玩家在该注册天数段的每天钓鱼次数）
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY daily_fishing_count ASC), 0) AS daily_fishing_count_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY daily_fishing_count ASC), 0) AS daily_fishing_count_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY daily_fishing_count ASC), 0) AS daily_fishing_count_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY daily_fishing_count ASC), 0) AS daily_fishing_count_p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY daily_fishing_count ASC), 0) AS daily_fishing_count_p95,
    -- 每天掷骰子次数分位数（所有玩家在该注册天数段的每天掷骰子次数）
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY daily_dice_roll_count ASC), 0) AS daily_dice_roll_count_p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY daily_dice_roll_count ASC), 0) AS daily_dice_roll_count_p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY daily_dice_roll_count ASC), 0) AS daily_dice_roll_count_p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY daily_dice_roll_count ASC), 0) AS daily_dice_roll_count_p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY daily_dice_roll_count ASC), 0) AS daily_dice_roll_count_p95
FROM
    RegDaysClustered
GROUP BY
    reg_days_group
ORDER BY
    MIN(reg_day);
