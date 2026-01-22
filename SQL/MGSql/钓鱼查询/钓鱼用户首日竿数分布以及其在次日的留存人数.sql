-- 1. 找出指定注册日期的用户 (我们的分析队列)
WITH NewUsers AS (
    SELECT
        user_id,
        date(to_timestamp(cast(create_time as BIGINT)/1000)) AS reg_date
    FROM
        table.user_20652
    WHERE
        -- [!] 请在这里设定您要统计的新用户注册周期
        date(to_timestamp(cast(create_time as BIGINT)/1000)) between '2025-11-07' and '2025-11-14'
),
FISH_HOOK_COUNT AS (
    SELECT
        user_id,
        day,
        count(*) as fish_hook_count
    FROM
        table.event_20652
    WHERE
        day between '2025-11-07' and '2025-11-15'
        and event_id='FISH_HOOK'
    group by user_id,day
),

-- 2. 统计这些用户首日(Day 0)使用过的“不同鱼竿种类数”
FirstDayActivity AS (
    SELECT
        nu.user_id,
        nu.reg_date,
        -- [!] 核心假设：这里统计的是“鱼竿种类数” (distinct rod types)
        f_d0.fish_hook_count AS day0_distinct_rod_count
    FROM
        NewUsers nu
    JOIN
        -- (使用 INNER JOIN，因为我们只关心首日有钓鱼行为的用户)
        FISH_HOOK_COUNT f_d0 
        ON nu.user_id = f_d0.user_id
    WHERE
        -- 关键：首日 = 注册当天
        f_d0.day = nu.reg_date
),

-- 3. 检查这些用户次日(Day 1)是否也活跃 (D1 留存)
RetentionCheck AS (
    SELECT
        d0.user_id,
        d0.reg_date,
        d0.day0_distinct_rod_count,
        -- 通过 LEFT JOIN 检查次日是否有任何钓鱼记录
        CASE
            WHEN f_d1.user_id IS NOT NULL THEN 1
            ELSE 0
        END AS played_day_1  -- '1' 代表次日留存, '0' 代表流失
    FROM
        FirstDayActivity d0
    LEFT JOIN
        FISH_HOOK_COUNT f_d1
        ON f_d1.user_id = d0.user_id
        -- 关键：次日 = 注册日 + 1天
        AND datediff(f_d1.day, d0.reg_date) = 1
)

-- 4. 最终聚合：
-- 按首日使用的鱼竿种类数分组，统计总用户及次日留存用户
SELECT
    day0_distinct_rod_count,
    COUNT(user_id) AS total_users_in_group,
    SUM(CASE WHEN played_day_1 = 1 THEN 1 ELSE 0 END) AS retained_users_day_1
FROM
    RetentionCheck
GROUP BY
    day0_distinct_rod_count
ORDER BY
    day0_distinct_rod_count;