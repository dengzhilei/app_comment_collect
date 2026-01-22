select proj_result,count(*) as count 
from table.event_20652
where event_id='TRAIN_RESULT'
and day ${PartDate:date1}
and CAST(proj_level AS numeric)>=4
and proj_type='attack'
group by proj_result