/*
我们想要观察  玩家余额和使用倍率的比值关系，
我们定义平均比值为，玩家每次下注的余额之和，除以倍率之和，
先计算每个玩家每天的这个平均比值，再取其分位数
*/

-- 步骤1: 获取所有掷骰子的消耗记录，提取每次的余额和倍率
WITH DiceRollRecords AS (
    SELECT
        proj_simple_game_id,
        day AS stat_date,
        -- 余额：使用掷骰子时的骰子余额
        CAST(proj_dice AS BIGINT) AS dice_balance,
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
        -- 确保字段有效
        AND proj_asset_value IS NOT NULL
        AND CAST(proj_asset_value AS INT) > 0
        AND proj_dice IS NOT NULL
        AND CAST(proj_dice AS BIGINT) > 0
),

-- 步骤2: 筛选当日掷骰子次数>20的玩家，并计算每个人每天的平均比值
PlayerDailyRatio AS (
    SELECT
        proj_simple_game_id,
        stat_date,
        COUNT(*) AS daily_dice_rolls,  -- 当天骰子次数
        -- 平均比值 = 每次下注的余额之和 / 倍率之和
        CAST(SUM(dice_balance) AS BIGINT) / CAST(SUM(bet_multiplying) AS BIGINT) AS avg_balance_ratio
    FROM
        DiceRollRecords
    GROUP BY
        proj_simple_game_id,
        stat_date
    HAVING
        COUNT(*) > 20  -- 只筛选当日掷骰子次数>20的玩家
        AND SUM(bet_multiplying) > 0  -- 确保倍率之和大于0
)

-- 步骤3: 按天计算这些玩家平均比值的各档分位数
SELECT
    stat_date,  -- 日期
    COUNT(proj_simple_game_id) AS player_count,  -- 符合条件的玩家数
    ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY avg_balance_ratio ASC), 0) AS p10,
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY avg_balance_ratio ASC), 0) AS p25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_balance_ratio ASC), 0) AS p50,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY avg_balance_ratio ASC), 0) AS p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY avg_balance_ratio ASC), 0) AS p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_balance_ratio ASC), 0) AS p95,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY avg_balance_ratio ASC), 0) AS p99,
    ROUND(AVG(avg_balance_ratio), 0) AS avg_ratio,  -- 平均比值的平均值
    ROUND(MIN(avg_balance_ratio), 0) AS min_ratio,  -- 最小平均比值
    ROUND(MAX(avg_balance_ratio), 0) AS max_ratio   -- 最大平均比值
FROM
    PlayerDailyRatio
GROUP BY
    stat_date
ORDER BY
    stat_date ASC