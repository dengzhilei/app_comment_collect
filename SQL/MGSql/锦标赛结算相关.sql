/*
TOURNAMENT_RANKING_RESULT	锦标赛结算

proj_tp_id	锦标赛活动id
proj_group	房间索引
proj_rank	排名
proj_arg_1	结算后赛季代币数
proj_arg_2	房间人数
proj_arg_3	是否触发赛季升级

输出  玩家id、日期、排名 表 
*/

SELECT
    proj_simple_game_id AS player_id,  -- 玩家ID
    day,  -- 日期
    proj_rank -- 排名
FROM
    table.event_20652
WHERE
    event_id = 'TOURNAMENT_RANKING_RESULT'  -- 锦标赛结算事件
    AND day ${PartDate:date1}
    AND proj_rank IS NOT NULL  -- 确保排名不为空
ORDER BY
    day,
    proj_tp_id,
    proj_rank;