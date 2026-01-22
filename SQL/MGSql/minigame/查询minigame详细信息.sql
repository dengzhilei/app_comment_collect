/* 
已知我们每天会开放若干个minigame活动，
每个minigame有一个主要活动代币id，
我现在有近期开放的活动的代币id，
我们想知道每天每个minigame的参与率，消耗主代币定义为参与活动 
注意：需要取全体用户作为全集，而不是只取参与了minigame的用户
注意：平台要求必须有关于day的限制
注意：实际使用的时间需要转换为UTC时间
注意：
    event_time是日志在后端记录时间，
    proj_action_bg_time是事件实际在前端时间，大部分时候和event_time接近，少部分时候主要是玩家离线玩的时候，会差别较大，
    所以优先用proj_action_bg_time
    如果proj_action_bg_time为空或者0，则用event_time
    注意:proj_action_bg_time和event_time都是毫秒级时间戳
        proj_action_bg_time是字符串类型，event_time是数字类型
*/

-- 步骤1: 定义"全量玩家"（全体用户，即DAU）
WITH all_players AS (
    SELECT DISTINCT
        from_unixtime(cast(COALESCE(NULLIF(CAST(proj_action_bg_time AS BIGINT), 0), event_time)/1000 as bigint),'yyyy-MM-dd') as utc_day,
        proj_simple_game_id
    FROM
        table.event_20652
    WHERE
        event_id = 'asset_circulate'  -- 金流日志, 代表当天活跃过
        AND day ${PartDateTz:dateTz1} -- 说明，平台要求必须有关于day的限制
        AND CAST(proj_level AS numeric) >= 3  -- 等级过滤
),

-- 步骤2: 定义要查询的minigame代币id列表和活动说明（请在这里填入代币id和活动说明）
minigame_tokens AS (
    SELECT token_id, activity_name
    FROM (
        VALUES 
            -- [!] 请在这里填入minigame的代币id和活动说明，格式：(代币id, '活动说明')
('100401', 'minigame5-共建-5天循环'),
('101311', 'minigame1-挖沙子-2天循环'),
('101321', 'minigame2-弹珠-2天循环'),
('101331', 'minigame3-翻牌-2天循环'),
('101341', 'minigame4-彩球排序-循环'),
('170111', 'minigame_G1_转盘_循环1'),
('173111', 'minigame_G3_刮刮乐_循环1二期'),
('174111', 'minigame_G4_砸罐子_循环')

    ) AS tokens(token_id, activity_name)
),

-- 步骤3: 找出参与minigame的用户（通过消耗主代币识别）
-- 注意需要将proj_action_bg_time转换为UTC时间，如果为空或0则使用event_time
-- proj_action_bg_time是字符串类型，需要先转换为BIGINT；event_time已经是BIGINT类型
participated_players AS (
    SELECT DISTINCT
        from_unixtime(cast(COALESCE(NULLIF(CAST(e.proj_action_bg_time AS BIGINT), 0), e.event_time)/1000 as bigint),'yyyy-MM-dd') as utc_day,
        e.proj_asset_id AS token_id,
        e.proj_simple_game_id
    FROM
        table.event_20652 e
    INNER JOIN
        minigame_tokens mt
        ON e.proj_asset_id = mt.token_id
    WHERE
        e.event_id = 'asset_circulate'  -- 资产流转事件
        AND e.day ${PartDateTz:dateTz1} -- 说明，平台要求必须有关于day的限制
        AND CAST(e.proj_level AS numeric) >= 3
        AND e.proj_asset_change_type = '2'  -- 消耗类型：消耗主代币定义为参与活动
        and e.proj_asset_source!='C_ACTIVITY_END' -- 排除活动结束代币回收事件
        and e.proj_asset_source!='C_HIDDEN_TREASURE_RESOURCE_CONVERT' --临时排除一下挖沙子回收
        AND e.proj_asset_value IS NOT NULL  -- 确保道具数量不为空，与player_token_usage保持一致
),

-- 步骤3.5: 计算每个参与玩家每天使用的道具总数
player_token_usage AS (
    SELECT
        from_unixtime(cast(COALESCE(NULLIF(CAST(e.proj_action_bg_time AS BIGINT), 0), e.event_time)/1000 as bigint),'yyyy-MM-dd') as utc_day,
        e.proj_asset_id AS token_id,
        e.proj_simple_game_id,
        SUM(CAST(e.proj_asset_value AS BIGINT)) AS total_token_used  -- 每个玩家每天使用的道具总数
    FROM
        table.event_20652 e
    INNER JOIN
        minigame_tokens mt
        ON e.proj_asset_id = mt.token_id
    WHERE
        e.event_id = 'asset_circulate'  -- 资产流转事件
        AND e.day ${PartDateTz:dateTz1} -- 说明，平台要求必须有关于day的限制
        AND CAST(e.proj_level AS numeric) >= 3
        AND e.proj_asset_change_type = '2'  -- 消耗类型：消耗主代币定义为参与活动
        and e.proj_asset_source!='C_ACTIVITY_END' -- 排除活动结束代币回收事件
        and e.proj_asset_source!='C_HIDDEN_TREASURE_RESOURCE_CONVERT' --临时排除一下挖沙子回收
        AND e.proj_asset_value IS NOT NULL
    GROUP BY
        from_unixtime(cast(COALESCE(NULLIF(CAST(e.proj_action_bg_time AS BIGINT), 0), e.event_time)/1000 as bigint),'yyyy-MM-dd'),
        e.proj_asset_id,
        e.proj_simple_game_id
),

-- 步骤3.6: 计算每天每个minigame参与玩家使用道具数量的分位数分布
token_usage_percentiles AS (
    SELECT
        ptu.utc_day,
        ptu.token_id,
        COUNT(DISTINCT ptu.proj_simple_game_id) AS participated_players_count,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ptu.total_token_used ASC), 0) AS p25,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ptu.total_token_used ASC), 0) AS p50,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ptu.total_token_used ASC), 0) AS p75,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ptu.total_token_used ASC), 0) AS p90,
        ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ptu.total_token_used ASC), 0) AS p99
    FROM
        player_token_usage ptu
    GROUP BY
        ptu.utc_day,
        ptu.token_id
),

-- 步骤4: 计算每天每个minigame的参与率
participation_rate_result AS (
    SELECT
        ap.utc_day,
        mt.token_id AS minigame_token_id,
        mt.activity_name AS activity_description,  -- 活动说明
        COUNT(DISTINCT ap.proj_simple_game_id) AS total_players,  -- 全体用户数
        COUNT(DISTINCT pp.proj_simple_game_id) AS participated_players,  -- 参与用户数
        ROUND(
            COUNT(DISTINCT pp.proj_simple_game_id) * 100.0 / 
            NULLIF(COUNT(DISTINCT ap.proj_simple_game_id), 0), 
            0
        ) AS participation_rate  -- 参与率（整数，不带百分号）
    FROM
        all_players ap
    CROSS JOIN
        minigame_tokens mt
    LEFT JOIN
        participated_players pp
        ON ap.utc_day = pp.utc_day
        AND ap.proj_simple_game_id = pp.proj_simple_game_id
        AND mt.token_id = pp.token_id
    GROUP BY
        ap.utc_day,
        mt.token_id,
        mt.activity_name
    HAVING
        COUNT(DISTINCT pp.proj_simple_game_id) > 0  -- 过滤掉参与率为0的记录
)

-- 步骤5: 输出参与率和道具使用数量分布
SELECT
    -- prr.minigame_token_id,
    prr.activity_description,
    prr.utc_day,
    prr.total_players,
    CONCAT(CAST(prr.participation_rate AS STRING), '%') AS participation_rate,  -- 参与率（整数+百分号）
    -- 道具使用数量分布
    tup.participated_players_count AS token_usage_players_count,  -- 参与玩家数（用于道具使用统计）
    tup.p25 AS token_usage_p25,
    tup.p50 AS token_usage_p50,
    tup.p75 AS token_usage_p75,
    tup.p90 AS token_usage_p90,
    tup.p99 AS token_usage_p99
FROM
    participation_rate_result prr
LEFT JOIN
    token_usage_percentiles tup
    ON prr.utc_day = tup.utc_day
    AND prr.minigame_token_id = tup.token_id
ORDER BY
    prr.activity_description,
    prr.utc_day;