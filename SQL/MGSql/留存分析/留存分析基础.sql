/*
留存分析基础
按注册日期统计不同天数的留存情况

留存定义：用户在注册后第N天有进入游戏事件（CS_ENTER_GAME）就算留存
统计留存天数：1、3、5、7、14、30天
*/

-- 1. 获取指定注册时间段的用户，并计算注册日期
WITH NewUsers AS (
    SELECT
        proj_simple_game_id AS user_id,
        date(to_timestamp(cast(create_time as BIGINT)/1000)) AS reg_date
    FROM
        table.user_20652
    WHERE
        -- [!] 请在这里设定您要统计的新用户注册周期
        date(to_timestamp(cast(create_time as BIGINT)/1000)) ${PartDate:date1}
),

-- 2. 先从event_20652表中筛选出符合条件的事件（限定时间范围和事件类型，提高查询效率）
FilteredEvents AS (
    SELECT DISTINCT
        proj_simple_game_id AS user_id,
        event_time,
        -- 从event_time计算日期，避免时区问题
        date(to_timestamp(cast(event_time AS BIGINT)/1000)) AS event_date
    FROM
        table.event_20652
    WHERE
        event_id = 'CS_ENTER_GAME'
        AND event_time IS NOT NULL
        -- [!] 请在这里设定您要统计的日期范围（玩家行为统计期间）
        -- 使用day字段限定时间范围，可以利用索引提高查询效率
        AND day ${PartDate:date2}
),

-- 3. 获取所有用户在注册后不同天数的留存情况（通过CS_ENTER_GAME事件判断是否有活跃）
UserRetentionDays AS (
    SELECT DISTINCT
        nu.user_id,
        nu.reg_date,
        fe.event_date AS check_date,
        DATEDIFF(fe.event_date, nu.reg_date) AS retention_day
    FROM
        NewUsers nu
    INNER JOIN
        FilteredEvents fe
        ON nu.user_id = fe.user_id
    WHERE
        -- 筛选注册后第1、3、5、7、14、30天（注册当天为第0天）
        DATEDIFF(fe.event_date, nu.reg_date) IN (1, 3, 5, 7, 14, 30)
),

-- 4. 计算每个用户在指定留存天数的留存状态（1=留存，0=未留存）
UserRetentionStatus AS (
    SELECT
        nu.user_id,
        nu.reg_date,
        rd.retention_day,
        CASE WHEN urd.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_retained
    FROM
        NewUsers nu
    CROSS JOIN
        (SELECT 1 AS retention_day UNION ALL SELECT 3 UNION ALL SELECT 5 UNION ALL SELECT 7 UNION ALL SELECT 14 UNION ALL SELECT 30) AS rd
    LEFT JOIN
        UserRetentionDays urd
        ON nu.user_id = urd.user_id
        AND nu.reg_date = urd.reg_date  -- 确保匹配同一注册日期的用户
        AND rd.retention_day = urd.retention_day
),

-- 5. 按注册日期和留存天数分组，计算留存率和留存人数
RetentionByDay AS (
    SELECT
        reg_date,
        retention_day,
        COUNT(DISTINCT user_id) AS total_users,
        SUM(is_retained) AS retained_users,
        ROUND(SUM(is_retained) * 100.0 / COUNT(DISTINCT user_id), 2) AS retention_rate
    FROM
        UserRetentionStatus
    GROUP BY
        reg_date,
        retention_day
),

-- 6. 将留存天数转换为列（1、3、5、7、14、30天作为列）
RetentionByDate AS (
    SELECT
        reg_date,
        -- 总人数（所有留存天数都是同一批用户，取第1天的总人数）
        MAX(CASE WHEN retention_day = 1 THEN total_users END) AS total_users,
        -- 各留存天数的留存率
        MAX(CASE WHEN retention_day = 1 THEN retention_rate END) AS retention_rate_1,
        MAX(CASE WHEN retention_day = 3 THEN retention_rate END) AS retention_rate_3,
        MAX(CASE WHEN retention_day = 5 THEN retention_rate END) AS retention_rate_5,
        MAX(CASE WHEN retention_day = 7 THEN retention_rate END) AS retention_rate_7,
        MAX(CASE WHEN retention_day = 14 THEN retention_rate END) AS retention_rate_14,
        MAX(CASE WHEN retention_day = 30 THEN retention_rate END) AS retention_rate_30
    FROM
        RetentionByDay
    GROUP BY
        reg_date
)

-- 7. 输出结果：按注册日期显示不同天数的留存情况
SELECT
    reg_date AS 注册日期,
    total_users AS 总人数,
    retention_rate_1 AS 第1天留存率,
    retention_rate_3 AS 第3天留存率,
    retention_rate_5 AS 第5天留存率,
    retention_rate_7 AS 第7天留存率,
    retention_rate_14 AS 第14天留存率,
    retention_rate_30 AS 第30天留存率
FROM
    RetentionByDate
ORDER BY
    reg_date;

