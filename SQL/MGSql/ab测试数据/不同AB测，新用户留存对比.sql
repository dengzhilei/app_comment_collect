/*
不同AB测，新用户留存对比
玩家分为4组，根据 user_20652表里：
- proj_ab_bucket_1字段：1-100 分为B1组，101-200分为A1组
- proj_ab_bucket_2字段：1-100 分为B2组，101-200分为A2组
分组方式：
- A1组：proj_ab_bucket_1 在 101-200（包含原来的 A1A2 + A1B2 的所有用户）
- A2组：proj_ab_bucket_2 在 101-200（包含原来的 A1A2 + B1A2 的所有用户）
- B1组：proj_ab_bucket_1 在 1-100（包含原来的 B1A2 + B1B2 的所有用户）
- B2组：proj_ab_bucket_2 在 1-100（包含原来的 A1B2 + B1B2 的所有用户）

统计指定注册日期的新用户，在注册后第1、2、3、5、7天的留存情况
留存定义：用户在注册后第N天有进入游戏事件（CS_ENTER_GAME）就算留存
每个组的留存需要重新计算，不能简单相加
汇总：所有用户（不管AB组）的留存情况
一共输出5行：4组分别的留存数据 + 1行汇总数据
*/

-- 1. 获取指定注册时间段的用户基础信息
WITH UserBase AS (
    SELECT
        proj_simple_game_id AS user_id,
        date(to_timestamp(cast(create_time as BIGINT)/1000)) AS reg_date,
        CAST(proj_ab_bucket_1 AS INT) AS ab_bucket_1,
        CAST(proj_ab_bucket_2 AS INT) AS ab_bucket_2
    FROM
        table.user_20652
    WHERE
        -- [!] 请在这里设定您要统计的新用户注册周期
        date(to_timestamp(cast(create_time as BIGINT)/1000)) ${PartDate:date1}
        AND proj_ab_bucket_1 IS NOT NULL
        AND CAST(proj_ab_bucket_1 AS INT) BETWEEN 1 AND 200
        AND proj_ab_bucket_2 IS NOT NULL
        AND CAST(proj_ab_bucket_2 AS INT) BETWEEN 1 AND 200
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

-- 3. 获取所有用户在注册后第1、2、3、5、7天的留存情况（通过CS_ENTER_GAME事件判断是否有活跃）
AllUserRetentionDays AS (
    SELECT DISTINCT
        ub.user_id,
        ub.reg_date,
        fe.event_date AS check_date,
        DATEDIFF(fe.event_date, ub.reg_date) AS retention_day
    FROM
        UserBase ub
    INNER JOIN
        FilteredEvents fe
        ON ub.user_id = fe.user_id
    WHERE
        -- 筛选注册后第1、2、3、5、7天（注册当天为第0天）
        DATEDIFF(fe.event_date, ub.reg_date) IN (1, 2, 3, 5, 7)
),

-- 4. 计算每个用户在指定留存天数的留存状态（1=留存，0=未留存）- 所有用户
AllUserRetentionStatus AS (
    SELECT
        ub.user_id,
        ub.reg_date,
        rd.retention_day,
        CASE WHEN urd.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_retained
    FROM
        UserBase ub
    CROSS JOIN
        (SELECT 1 AS retention_day UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 5 UNION ALL SELECT 7) AS rd
    LEFT JOIN
        AllUserRetentionDays urd
        ON ub.user_id = urd.user_id
        AND ub.reg_date = urd.reg_date
        AND rd.retention_day = urd.retention_day
),

-- 5. 为每个AB组计算留存（重新计算，不是简单相加）
ABGroupRetentionByDay AS (
    SELECT
        'A1' AS ab_group,
        urs.reg_date,
        urs.retention_day,
        COUNT(DISTINCT CASE WHEN ub.ab_bucket_1 BETWEEN 101 AND 200 THEN urs.user_id END) AS total_users,
        SUM(CASE WHEN ub.ab_bucket_1 BETWEEN 101 AND 200 THEN urs.is_retained ELSE 0 END) AS retained_users
    FROM
        AllUserRetentionStatus urs
    INNER JOIN
        UserBase ub
        ON urs.user_id = ub.user_id
        AND urs.reg_date = ub.reg_date
    GROUP BY
        urs.reg_date,
        urs.retention_day

    UNION ALL

    SELECT
        'A2' AS ab_group,
        urs.reg_date,
        urs.retention_day,
        COUNT(DISTINCT CASE WHEN ub.ab_bucket_2 BETWEEN 101 AND 200 THEN urs.user_id END) AS total_users,
        SUM(CASE WHEN ub.ab_bucket_2 BETWEEN 101 AND 200 THEN urs.is_retained ELSE 0 END) AS retained_users
    FROM
        AllUserRetentionStatus urs
    INNER JOIN
        UserBase ub
        ON urs.user_id = ub.user_id
        AND urs.reg_date = ub.reg_date
    GROUP BY
        urs.reg_date,
        urs.retention_day

    UNION ALL

    SELECT
        'B1' AS ab_group,
        urs.reg_date,
        urs.retention_day,
        COUNT(DISTINCT CASE WHEN ub.ab_bucket_1 BETWEEN 1 AND 100 THEN urs.user_id END) AS total_users,
        SUM(CASE WHEN ub.ab_bucket_1 BETWEEN 1 AND 100 THEN urs.is_retained ELSE 0 END) AS retained_users
    FROM
        AllUserRetentionStatus urs
    INNER JOIN
        UserBase ub
        ON urs.user_id = ub.user_id
        AND urs.reg_date = ub.reg_date
    GROUP BY
        urs.reg_date,
        urs.retention_day

    UNION ALL

    SELECT
        'B2' AS ab_group,
        urs.reg_date,
        urs.retention_day,
        COUNT(DISTINCT CASE WHEN ub.ab_bucket_2 BETWEEN 1 AND 100 THEN urs.user_id END) AS total_users,
        SUM(CASE WHEN ub.ab_bucket_2 BETWEEN 1 AND 100 THEN urs.is_retained ELSE 0 END) AS retained_users
    FROM
        AllUserRetentionStatus urs
    INNER JOIN
        UserBase ub
        ON urs.user_id = ub.user_id
        AND urs.reg_date = ub.reg_date
    GROUP BY
        urs.reg_date,
        urs.retention_day
),

-- 6. 计算各组的留存率
ABGroupRetentionWithRate AS (
    SELECT
        ab_group,
        reg_date,
        retention_day,
        total_users,
        retained_users,
        ROUND(retained_users * 100.0 / NULLIF(total_users, 0), 2) AS retention_rate
    FROM
        ABGroupRetentionByDay
),

-- 7. 将留存天数转换为列（1、2、3、5、7天作为列）
ABGroupRetention AS (
    SELECT
        ab_group,
        reg_date,
        -- 总人数（所有留存天数都是同一批用户，取第1天的总人数）
        MAX(CASE WHEN retention_day = 1 THEN total_users END) AS total_users,
        -- 各留存天数的留存率
        MAX(CASE WHEN retention_day = 1 THEN retention_rate END) AS retention_rate_1,
        MAX(CASE WHEN retention_day = 2 THEN retention_rate END) AS retention_rate_2,
        MAX(CASE WHEN retention_day = 3 THEN retention_rate END) AS retention_rate_3,
        MAX(CASE WHEN retention_day = 5 THEN retention_rate END) AS retention_rate_5,
        MAX(CASE WHEN retention_day = 7 THEN retention_rate END) AS retention_rate_7
    FROM
        ABGroupRetentionWithRate
    GROUP BY
        ab_group,
        reg_date
),

-- 8. 汇总数据：所有用户（不管AB组）的留存情况
AllUserRetentionByDay AS (
    SELECT
        reg_date,
        retention_day,
        COUNT(DISTINCT user_id) AS total_users,
        SUM(is_retained) AS retained_users,
        ROUND(SUM(is_retained) * 100.0 / COUNT(DISTINCT user_id), 2) AS retention_rate
    FROM
        AllUserRetentionStatus
    GROUP BY
        reg_date,
        retention_day
),

AllUserRetention AS (
    SELECT
        reg_date,
        MAX(CASE WHEN retention_day = 1 THEN total_users END) AS total_users,
        MAX(CASE WHEN retention_day = 1 THEN retention_rate END) AS retention_rate_1,
        MAX(CASE WHEN retention_day = 2 THEN retention_rate END) AS retention_rate_2,
        MAX(CASE WHEN retention_day = 3 THEN retention_rate END) AS retention_rate_3,
        MAX(CASE WHEN retention_day = 5 THEN retention_rate END) AS retention_rate_5,
        MAX(CASE WHEN retention_day = 7 THEN retention_rate END) AS retention_rate_7
    FROM
        AllUserRetentionByDay
    GROUP BY
        reg_date
)

-- 9. 输出结果：先输出4组分别的留存数据，然后输出汇总数据
SELECT
    result.注册日期,
    result.AB组,
    result.总人数,
    result.第1天留存率,
    result.第2天留存率,
    result.第3天留存率,
    result.第5天留存率,
    result.第7天留存率
FROM (
    SELECT
        reg_date AS 注册日期,
        ab_group AS AB组,
        total_users AS 总人数,
        retention_rate_1 AS 第1天留存率,
        retention_rate_2 AS 第2天留存率,
        retention_rate_3 AS 第3天留存率,
        retention_rate_5 AS 第5天留存率,
        retention_rate_7 AS 第7天留存率
    FROM
        ABGroupRetention

    UNION ALL

    -- 汇总数据：所有用户（不管AB组）
    SELECT
        reg_date AS 注册日期,
        '汇总' AS AB组,
        total_users AS 总人数,
        retention_rate_1 AS 第1天留存率,
        retention_rate_2 AS 第2天留存率,
        retention_rate_3 AS 第3天留存率,
        retention_rate_5 AS 第5天留存率,
        retention_rate_7 AS 第7天留存率
    FROM
        AllUserRetention
) AS result

ORDER BY
    result.注册日期,
    CASE WHEN result.AB组 = '汇总' THEN 1 ELSE 0 END,  -- 汇总行放在最后
    result.AB组;
