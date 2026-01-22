select proj_multiplying,proj_reward_coin_multi,cast(cast(proj_coin_win as bigint)/proj_reward_coin_multi/proj_multiplying as int) as coin_win_ratio,proj_result 
from table.event_20652
where event_id='TRAIN_RESULT'
and day ${PartDate:date1}
and proj_simple_game_id='20021892'
and CAST(proj_level AS numeric)>=4