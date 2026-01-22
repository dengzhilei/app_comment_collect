/*
鱼册完成时会有一条金流日志
proj_asset_source=C_FISH_ALBUM_FINISH
fishSceneTpId代表对应的渔场
一共3个渔场
第一个渔场是400301
第二个渔场是400302
第三个渔场是400303（注释中写的是400302，可能是笔误）

我现在想看，指定某天注册的用户，在留存的第0、1、2、3、4、5、6、7天时，鱼册完成进度 如何，
比如我们定义 0为一个渔场都没有完成的，1为1个完成的，2为完成2个的，3为完成3个的。
输出这些用户，每一天的，留存人数以及，处于0、1、2、3状态的百分比
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

-- 2. 获取所有鱼册完成事件，并标记当天是注册第几天
FishAlbumCompleted AS (
    SELECT
        e.proj_simple_game_id AS user_id,
        e.day AS event_date,
        nu.reg_date,
        -- 计算当天是注册第几天（注册当天为第0天）
        DATEDIFF(e.day, nu.reg_date) AS reg_day,
        -- fishSceneTpId（假设是proj_arg_1，如果不对请修改）
        CAST(e.proj_arg_1 AS VARCHAR) AS fishery_id
    FROM
        table.event_20652 e
    INNER JOIN
        NewUsers nu
        ON e.proj_simple_game_id = nu.user_id
    WHERE
        e.event_id = 'asset_circulate'
        AND e.proj_asset_source = 'C_FISH_ALBUM_FINISH'
        -- [!] 请在这里设定您要统计的日期范围（玩家行为统计期间）
        AND e.day ${PartDate:date2}
        AND DATEDIFF(e.day, nu.reg_date) >= 0  -- 确保行为日期不早于注册日期
        AND e.proj_arg_1 IS NOT NULL
        AND CAST(e.proj_arg_1 AS VARCHAR) IN ('400301', '400302', '400303')  -- 三个渔场
),

-- 3. 计算每个用户到每天为止完成的渔场数量（累积，去重）
UserDailyFisheryProgress AS (
    SELECT
        fac.user_id,
        fac.event_date,
        fac.reg_day,
        -- 计算到该天为止完成的渔场数量（去重，累积）
        COUNT(DISTINCT fac2.fishery_id) AS completed_fishery_count
    FROM
        FishAlbumCompleted fac
    LEFT JOIN
        FishAlbumCompleted fac2
        ON fac.user_id = fac2.user_id
        AND fac2.event_date <= fac.event_date  -- 累积计算
    GROUP BY
        fac.user_id,
        fac.event_date,
        fac.reg_day
),

-- 4. 获取所有用户在注册后第0-7天的留存情况（从event_20652表中获取所有日期，用datediff筛选）
UserDailyRetention AS (
    SELECT DISTINCT
        nu.user_id,
        nu.reg_date,
        e.day AS check_date,
        DATEDIFF(e.day, nu.reg_date) AS retention_day
    FROM
        NewUsers nu
    INNER JOIN
        table.event_20652 e
        ON nu.user_id = e.proj_simple_game_id
    WHERE
        e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围（玩家行为统计期间）
        AND e.day ${PartDate:date2}
        -- 筛选注册后第0-7天（注册当天为第0天）
        AND DATEDIFF(e.day, nu.reg_date) BETWEEN 0 AND 7
),

-- 6. 判断用户在该天是否有活跃（通过event_20652表判断）
UserDailyActive AS (
    SELECT DISTINCT
        udr.user_id,
        udr.retention_day,
        udr.check_date,
        CASE WHEN e.proj_simple_game_id IS NOT NULL THEN 1 ELSE 0 END AS is_active
    FROM
        UserDailyRetention udr
    LEFT JOIN
        table.event_20652 e
        ON udr.user_id = e.proj_simple_game_id
        AND udr.check_date = e.day
        AND e.event_id = 'asset_circulate'
        -- [!] 请在这里设定您要统计的日期范围（玩家行为统计期间）
        AND e.day ${PartDate:date2}
),

-- 7. 合并留存数据和渔场完成进度（计算到该天为止完成的渔场数量）
UserDailyStatus AS (
    SELECT
        uda.user_id,
        uda.retention_day,
        uda.check_date,
        uda.is_active,
        -- 计算到该天为止完成的渔场数量（累积，去重）
        COALESCE(
            (SELECT COUNT(DISTINCT fac.fishery_id)
             FROM FishAlbumCompleted fac
             WHERE fac.user_id = uda.user_id
             AND fac.event_date <= uda.check_date),
            0
        ) AS completed_fishery_count
    FROM
        UserDailyActive uda
    WHERE
        uda.is_active = 1  -- 只统计留存用户
),

-- 8. 将完成的渔场数量转换为状态（0、1、2、3）
UserDailyState AS (
    SELECT
        user_id,
        retention_day,
        check_date,
        completed_fishery_count,
        -- 状态：0=0个，1=1个，2=2个，3=3个（超过3个也算3个）
        LEAST(completed_fishery_count, 3) AS fishery_state
    FROM
        UserDailyStatus
)

-- 9. 按留存天数和状态分组，计算留存人数和百分比
SELECT
    retention_day AS 留存天数,
    COUNT(DISTINCT user_id) AS 留存人数,
    -- 处于状态0的百分比
    ROUND(SUM(CASE WHEN fishery_state = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT user_id), 2) AS 状态0_百分比,
    -- 处于状态1的百分比
    ROUND(SUM(CASE WHEN fishery_state = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT user_id), 2) AS 状态1_百分比,
    -- 处于状态2的百分比
    ROUND(SUM(CASE WHEN fishery_state = 2 THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT user_id), 2) AS 状态2_百分比,
    -- 处于状态3的百分比
    ROUND(SUM(CASE WHEN fishery_state = 3 THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT user_id), 2) AS 状态3_百分比,
    -- 各状态的人数（用于验证）
    SUM(CASE WHEN fishery_state = 0 THEN 1 ELSE 0 END) AS 状态0_人数,
    SUM(CASE WHEN fishery_state = 1 THEN 1 ELSE 0 END) AS 状态1_人数,
    SUM(CASE WHEN fishery_state = 2 THEN 1 ELSE 0 END) AS 状态2_人数,
    SUM(CASE WHEN fishery_state = 3 THEN 1 ELSE 0 END) AS 状态3_人数
FROM
    UserDailyState
GROUP BY
    retention_day
ORDER BY
    retention_day;
