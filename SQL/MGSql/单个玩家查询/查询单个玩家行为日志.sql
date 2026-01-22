/*
根据金流日志来查询，
查询指定玩家id，
逐行显示：时间、玩家行为（钓鱼、掷骰子、建造 对应花费鱼饵、骰子、金币）、玩家此时花费的对应的资源的数量、玩家此时的鱼饵存量、金币存量、骰子存量(这三个都有单独的字段记录)
*/

SELECT
    -- 时间（优先使用proj_action_bg_time，如果为空则使用event_time）
    from_unixtime(cast(COALESCE(NULLIF(CAST(proj_action_bg_time AS BIGINT), 0), event_time)/1000 as bigint),'yyyy-MM-dd HH:mm:ss') AS action_time,
    
    -- 玩家行为类型
    CASE 
        WHEN proj_asset_id = '100600' AND proj_asset_change_type = '2' AND CAST(proj_asset_source_type AS INT) = 6 THEN '钓鱼'
        WHEN proj_asset_id = '100100' AND proj_asset_change_type = '2' AND CAST(proj_asset_source_type AS INT) = 1 THEN '掷骰子'
        WHEN proj_asset_id = '100200' AND proj_asset_change_type = '2' THEN '建造'
        ELSE '其他'
    END AS player_action,
    
    -- 花费的资源类型
    CASE 
        WHEN proj_asset_id = '100600' THEN '鱼饵'
        WHEN proj_asset_id = '100100' THEN '骰子'
        WHEN proj_asset_id = '100200' THEN '金币'
        ELSE '其他'
    END AS cost_resource_type,
    
    -- 花费的资源数量
    CASE 
        WHEN proj_asset_id = '100200' AND proj_asset_change_type = '2' THEN 
            CAST(CAST(proj_asset_value AS BIGINT) / CAST(proj_reward_coin_multi AS INT) AS BIGINT)
        ELSE 
            CAST(proj_asset_value AS BIGINT)
    END AS cost_amount,
    
    -- 鱼饵存量
    CAST(proj_bait_num AS BIGINT) AS bait_balance,
    
    -- 骰子存量
    CAST(proj_dice AS BIGINT) AS dice_balance,
    
    -- 金币存量（需要除以膨胀系数）
    CAST(CAST(proj_coin AS BIGINT) / CAST(proj_reward_coin_multi AS INT) AS BIGINT) AS coin_balance

FROM
    table.event_20652

WHERE
    event_id = 'asset_circulate'
    AND proj_asset_change_type = '2'  -- 只查询花费行为
    AND proj_simple_game_id = '20021892'  -- [!] 请在这里设定要查询的玩家ID
    AND day ${PartDate:date1}  -- [!] 请在这里设定要查询的日期范围
    -- 只保留有行为意义的记录（钓鱼、掷骰子、建造）
    AND (
        (proj_asset_id = '100600' AND CAST(proj_asset_source_type AS INT) = 6) OR  -- 钓鱼（花费鱼饵）
        (proj_asset_id = '100100' AND CAST(proj_asset_source_type AS INT) = 1) OR  -- 掷骰子（花费骰子）
        (proj_asset_id = '100200')  -- 建造（花费金币）
    )
    -- 确保存量字段不为空
    AND proj_bait_num IS NOT NULL
    AND proj_dice IS NOT NULL
    AND proj_coin IS NOT NULL
    AND proj_reward_coin_multi IS NOT NULL
    AND CAST(proj_reward_coin_multi AS INT) > 0

ORDER BY
    action_time ASC
