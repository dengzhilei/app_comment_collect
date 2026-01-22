select proj_protect_id,count(*) as count from table.event_20652 
where event_id='BOARD_MOVE'
and day ${PartDate:date1}
and cast(proj_level as int)>=3
group by proj_protect_id
order by count desc