insert into intelligence.intervention_catalog(key,name,description,definition,version,is_active)
values
('FOCUS_WEAK_SUBJECT','Weak subject drill','Target the lowest-performing subject with focused practice.',jsonb_build_object('type','SUBJECT_DRILL'),1,true),
('SLOW_DOWN_DECISIONS','Decision pacing drill','Use timed questions with deliberate answer selection.',jsonb_build_object('type','PACING_DRILL'),1,true),
('CONFIDENCE_CALIBRATION','Confidence calibration drill','Pair confidence ratings with outcome review.',jsonb_build_object('type','CALIBRATION_DRILL'),1,true)
on conflict(key) do update set name=excluded.name,description=excluded.description,definition=excluded.definition,version=excluded.version,is_active=excluded.is_active,updated_at=now();