select sum(cast(proj_asset_value as bigint)) as cost_dice,max(cast(proj_level as int)) as final_level
from table.event_20652
where event_id='asset_circulate'
and day ${PartDate:date1}
and proj_asset_id = '100100'
and proj_asset_change_type='2'
and proj_simple_game_id='20021892'