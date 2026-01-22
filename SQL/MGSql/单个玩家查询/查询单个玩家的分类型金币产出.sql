with tb_coin as (
    select cast(sum(cast(proj_asset_value as bigint)/proj_reward_coin_multi) as int) as reward_coin,proj_simple_game_id,proj_asset_source_type
    from table.event_20652
    where event_id='asset_circulate'
    and day ${PartDate:date1}
    and proj_asset_id = '100200'
    and CAST(proj_level AS numeric)>=4
    and proj_asset_change_type='1'
    and proj_simple_game_id='20021892'
    group by proj_simple_game_id,proj_asset_source_type
),

tb_cost_dice as (
    select sum(cast(proj_asset_value as bigint)) as cost_dice,proj_simple_game_id
    from table.event_20652
    where event_id='asset_circulate'
    and day ${PartDate:date1}
    and proj_asset_id = '100100'
    and CAST(proj_level AS numeric)>=4
    and proj_asset_change_type='2'
    and proj_simple_game_id='20021892'
    group by proj_simple_game_id
),

tb_total_coin_dice_ratio as (
    select tb_coin.proj_simple_game_id,tb_coin.proj_asset_source_type,tb_coin.reward_coin,tb_cost_dice.cost_dice,cast(tb_coin.reward_coin/tb_cost_dice.cost_dice as int) as coin_dice_ratio
    from tb_coin
    left join tb_cost_dice
    on tb_coin.proj_simple_game_id = tb_cost_dice.proj_simple_game_id
    where tb_cost_dice.cost_dice is not null
    and cost_dice > 100
)



select *
from tb_total_coin_dice_ratio