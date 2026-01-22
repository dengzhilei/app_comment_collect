with tb_coin as (
    select proj_asset_source,cast(sum(cast(proj_asset_value as bigint)/proj_reward_coin_multi) as int) as reward_coin,count(*) as count
    from table.event_20652
    where event_id='asset_circulate'
    and day ${PartDate:date1}
    and proj_asset_id = '100200'
    and CAST(proj_level AS numeric)>=4
    and proj_asset_change_type='1'
    and proj_simple_game_id='20021892'
    group by proj_asset_source
)
select *,cast(reward_coin/count as int) as coin_per_count from tb_coin