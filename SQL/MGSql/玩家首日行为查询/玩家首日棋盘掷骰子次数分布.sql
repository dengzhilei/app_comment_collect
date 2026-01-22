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

-- 2. 获取这些用户首日(Day 0)的棋盘掷骰子次数数据
FirstDayBoardDiceCount AS (
    SELECT
        nu.user_id,
        nu.reg_date,
        -- 计算首日棋盘掷骰子次数（每次消耗骰子为1次，proj_asset_source_type = 1 表示棋盘）
        COALESCE(COUNT(CASE WHEN e.proj_asset_id = '100100' AND e.proj_asset_change_type = '2' AND CAST(e.proj_asset_source_type AS INT) = 1 THEN 1 END), 0) AS day0_board_dice_count
    FROM
        NewUsers nu
    LEFT JOIN
        table.event_20652 e
        ON nu.user_id = e.user_id
        AND e.event_id = 'asset_circulate'
        -- 关键：首日 = 注册当天
        AND e.day = nu.reg_date
    GROUP BY
        nu.user_id,
        nu.reg_date
),

-- 3. 按注册日期分组，计算棋盘掷骰子次数的分位数
percentiles AS (
    SELECT
        reg_date,  -- 注册日期维度
        COUNT(user_id) AS user_count,
        -- 棋盘掷骰子次数
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY day0_board_dice_count ASC), 0) AS board_p25,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY day0_board_dice_count ASC), 0) AS board_p50,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY day0_board_dice_count ASC), 0) AS board_p75,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY day0_board_dice_count ASC), 0) AS board_p90,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY day0_board_dice_count ASC), 0) AS board_p95,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY day0_board_dice_count ASC), 0) AS board_p99
    FROM
        FirstDayBoardDiceCount
    GROUP BY
        reg_date
)

-- 4. 输出棋盘掷骰子次数统计结果
SELECT 
    reg_date, 
    user_count, 
    board_p25 AS p25, 
    board_p50 AS p50, 
    board_p75 AS p75, 
    board_p90 AS p90, 
    board_p95 AS p95, 
    board_p99 AS p99
FROM percentiles
ORDER BY reg_date;

