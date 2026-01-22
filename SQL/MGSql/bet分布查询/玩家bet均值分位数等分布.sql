/*
根据金流日志的消耗日志，得出玩家每次掷骰子的倍率，
只计入map_level>=3的数据
只筛选当日掷骰子次数>20的玩家
计算这些人，每个人掷骰子的平均倍率，
然后求这些人平均倍率的各档分位数
*/

-- 步骤1: 获取所有掷骰子的消耗记录，提取每次的倍率
WITH DiceRollRecords AS (
    SELECT
        proj_simple_game_id,
        day AS stat_date,
        -- 倍率：直接使用消耗的骰子数量作为倍率
        CAST(proj_asset_value AS INT) AS bet_multiplying
    FROM
        table.event_20652
    WHERE
        event_id = 'asset_circulate'
        AND day ${PartDate:date1}  -- [!] 请在这里设定要查询的日期范围
        AND proj_asset_id = '100100'  -- 骰子
        AND proj_asset_change_type = '2'  -- 消耗
        AND CAST(proj_asset_source_type AS INT) = 1  -- 棋盘掷骰子
        AND CAST(proj_level AS numeric) >= 3  -- 只计入map_level>=3的数据
        -- 确保倍率字段有效
        AND proj_asset_value IS NOT NULL
        AND CAST(proj_asset_value AS INT) > 0
),

-- 步骤2: 筛选当日掷骰子次数>20的玩家，并计算每个人当天的平均倍率
PlayerDailyAvgBet AS (
    SELECT
        proj_simple_game_id,
        stat_date,
        COUNT(*) AS daily_dice_rolls,  -- 当天骰子次数
        AVG(bet_multiplying) AS avg_bet_multiplying  -- 当天平均倍率
    FROM
        DiceRollRecords
    GROUP BY
        proj_simple_game_id,
        stat_date
    HAVING
        COUNT(*) > 20  -- 只筛选当日掷骰子次数>20的玩家
)

-- 步骤3: 按天计算这些玩家平均倍率的各档分位数
SELECT
    stat_date,  -- 日期
    COUNT(proj_simple_game_id) AS player_count,  -- 符合条件的玩家数
    ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY avg_bet_multiplying ASC), 0) AS p10,
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY avg_bet_multiplying ASC), 0) AS p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_bet_multiplying ASC), 0) AS p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY avg_bet_multiplying ASC), 0) AS p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY avg_bet_multiplying ASC), 0) AS p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_bet_multiplying ASC), 0) AS p95,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY avg_bet_multiplying ASC), 0) AS p99,
    ROUND(AVG(avg_bet_multiplying), 0) AS avg_avg_bet,  -- 平均倍率的平均值
    ROUND(MIN(avg_bet_multiplying), 0) AS min_avg_bet,  -- 最小平均倍率
    ROUND(MAX(avg_bet_multiplying), 0) AS max_avg_bet   -- 最大平均倍率
FROM
    PlayerDailyAvgBet
GROUP BY
    stat_date
ORDER BY
    stat_date ASC