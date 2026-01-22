/*
查询每天的新用户在不同小时注册的分布
统计指定日期范围内，每天每2小时段（0-1点、2-3点、...、22-23点）注册的新用户数量
每个时间段作为一列显示
*/

-- 1. 获取指定日期范围内注册的用户，并提取注册日期和小时段
WITH NewUsers AS (
    SELECT
        proj_simple_game_id AS user_id,
        -- 使用to_char函数提取日期（YYYY-MM-DD）
        to_char(to_timestamp(cast(create_time AS BIGINT)/1000), 'YYYY-MM-DD') AS reg_date,
        -- 使用to_char函数提取小时（HH24表示24小时制，00-23），然后转换为INT
        CAST(to_char(to_timestamp(cast(create_time AS BIGINT)/1000), 'HH24') AS INT) AS reg_hour,
        -- 将小时分组为2小时段（0-1, 2-3, 4-5, ..., 22-23）
        FLOOR(CAST(to_char(to_timestamp(cast(create_time AS BIGINT)/1000), 'HH24') AS INT) / 2) AS hour_segment
    FROM
        table.user_20652
    WHERE
        -- [!] 请在这里设定您要统计的新用户注册周期
        to_char(to_timestamp(cast(create_time AS BIGINT)/1000), 'YYYY-MM-DD') ${PartDate:date1}
        AND create_time IS NOT NULL
),

-- 2. 按日期和小时段分组统计用户数量
HourlySegmentRegistration AS (
    SELECT
        reg_date,
        hour_segment,
        COUNT(DISTINCT user_id) AS user_count
    FROM
        NewUsers
    GROUP BY
        reg_date,
        hour_segment
),

-- 3. 计算每天的总注册用户数
DailyTotal AS (
    SELECT
        reg_date,
        SUM(user_count) AS daily_total_users
    FROM
        HourlySegmentRegistration
    GROUP BY
        reg_date
)

-- 4. 按日期分组，将每个2小时段作为一列输出
SELECT
    hsr.reg_date AS 注册日期,
    MAX(dt.daily_total_users) AS 当日总注册人数,
    -- 每个2小时段作为一列（0-1点、2-3点、...、22-23点）
    SUM(CASE WHEN hour_segment = 0 THEN user_count ELSE 0 END) AS 时段0_1点,
    SUM(CASE WHEN hour_segment = 1 THEN user_count ELSE 0 END) AS 时段2_3点,
    SUM(CASE WHEN hour_segment = 2 THEN user_count ELSE 0 END) AS 时段4_5点,
    SUM(CASE WHEN hour_segment = 3 THEN user_count ELSE 0 END) AS 时段6_7点,
    SUM(CASE WHEN hour_segment = 4 THEN user_count ELSE 0 END) AS 时段8_9点,
    SUM(CASE WHEN hour_segment = 5 THEN user_count ELSE 0 END) AS 时段10_11点,
    SUM(CASE WHEN hour_segment = 6 THEN user_count ELSE 0 END) AS 时段12_13点,
    SUM(CASE WHEN hour_segment = 7 THEN user_count ELSE 0 END) AS 时段14_15点,
    SUM(CASE WHEN hour_segment = 8 THEN user_count ELSE 0 END) AS 时段16_17点,
    SUM(CASE WHEN hour_segment = 9 THEN user_count ELSE 0 END) AS 时段18_19点,
    SUM(CASE WHEN hour_segment = 10 THEN user_count ELSE 0 END) AS 时段20_21点,
    SUM(CASE WHEN hour_segment = 11 THEN user_count ELSE 0 END) AS 时段22_23点
FROM
    HourlySegmentRegistration hsr
INNER JOIN
    DailyTotal dt
    ON hsr.reg_date = dt.reg_date
GROUP BY
    hsr.reg_date
ORDER BY
    hsr.reg_date;

