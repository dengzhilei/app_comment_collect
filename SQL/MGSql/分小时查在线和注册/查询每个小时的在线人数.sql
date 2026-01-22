/*
查询每个小时的在线人数
以金流日志发生用户数为在线人数
统计指定日期范围内，每天每个小时（0-23点）的在线人数
*/

-- 1. 获取金流事件，并提取日期和小时
WITH HourlyOnlineUsers AS (
    SELECT
        e.proj_simple_game_id AS user_id,
        -- 使用to_char函数提取日期（YYYY-MM-DD）
        to_char(to_timestamp(cast(e.event_time AS BIGINT)/1000), 'YYYY-MM-DD') AS event_date,
        -- 使用to_char函数提取小时（HH24表示24小时制，00-23），然后转换为INT
        CAST(to_char(to_timestamp(cast(e.event_time AS BIGINT)/1000), 'HH24') AS INT) AS event_hour
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
        AND e.event_time IS NOT NULL
),

-- 2. 按日期和小时分组统计去重用户数（在线人数）
HourlyOnlineCount AS (
    SELECT
        event_date,
        event_hour,
        COUNT(DISTINCT user_id) AS online_user_count,
        -- 合并日期和小时为一个字段（格式：YYYY-MM-DD HH）
        CONCAT(event_date, ' ', LPAD(CAST(event_hour AS VARCHAR), 2, '0')) AS date_hour
    FROM
        HourlyOnlineUsers
    GROUP BY
        event_date,
        event_hour
)

-- 3. 输出每天每个小时的在线人数
SELECT
    date_hour AS 日期小时,
    online_user_count AS 在线人数
FROM
    HourlyOnlineCount
ORDER BY
    event_date,
    event_hour;
