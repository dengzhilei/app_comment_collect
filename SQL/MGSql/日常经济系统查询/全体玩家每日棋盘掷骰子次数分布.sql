-- 1. 获取全体玩家每日的棋盘掷骰子次数数据
WITH DailyBoardDiceCount AS (
    SELECT
        e.user_id,
        e.day AS stat_date,
        -- 计算每日棋盘掷骰子次数（每次消耗骰子为1次，proj_asset_source_type = 1 表示棋盘）
        COALESCE(COUNT(CASE WHEN e.proj_asset_id = '100100' AND e.proj_asset_change_type = '2' AND CAST(e.proj_asset_source_type AS INT) = 1 THEN 1 END), 0) AS daily_board_dice_count
    FROM
        table.event_20652 e
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围
        AND e.day ${PartDate:date1}
    GROUP BY
        e.user_id,
        e.day
),

-- 2. 按日期分组，计算棋盘掷骰子次数的分位数
percentiles AS (
    SELECT
        stat_date,  -- 统计日期维度
        COUNT(user_id) AS user_count,
        -- 棋盘掷骰子次数
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY daily_board_dice_count ASC), 0) AS board_p25,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY daily_board_dice_count ASC), 0) AS board_p50,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY daily_board_dice_count ASC), 0) AS board_p75,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY daily_board_dice_count ASC), 0) AS board_p90,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY daily_board_dice_count ASC), 0) AS board_p95,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY daily_board_dice_count ASC), 0) AS board_p99
    FROM
        DailyBoardDiceCount
    GROUP BY
        stat_date
)

-- 3. 输出棋盘掷骰子次数统计结果
SELECT 
    stat_date, 
    user_count, 
    board_p25 AS p25, 
    board_p50 AS p50, 
    board_p75 AS p75, 
    board_p90 AS p90, 
    board_p95 AS p95, 
    board_p99 AS p99
FROM percentiles
ORDER BY stat_date;

