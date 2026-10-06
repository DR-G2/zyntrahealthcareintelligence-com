insert into amc.amc_plugin_version(version,status,config)
select '1.0.0','draft',jsonb_build_object(
  'source','AMC CAT MCQ Examination Specifications V8',
  'items',150,'duration_minutes',210,'options_per_item',5,
  'blueprint',jsonb_build_object(
    'ADULT_MEDICINE',0.30,'ADULT_SURGERY',0.20,'WOMENS_HEALTH',0.125,
    'CHILD_HEALTH',0.125,'MENTAL_HEALTH',0.125,'POPULATION_HEALTH',0.125
  ),
  'calibrated_item_floor',0.50,
  'adaptive_rule','Correct response increases difficulty; incorrect response decreases difficulty.',
  'status_note','Development configuration. Not a replica of AMC proprietary CAT selection/scoring.'
)
where not exists (select 1 from amc.amc_plugin_version where version='1.0.0');

insert into amc.amc_exam_environment(exam_key,version,environment,effective_from)
select 'AMC_CAT_MCQ','V8',
jsonb_build_object('items',150,'duration_minutes',210,'options_per_item',5,'calibrated_item_floor',0.50,'adaptive',true),
now()
where not exists (select 1 from amc.amc_exam_environment where exam_key='AMC_CAT_MCQ' and version='V8');

insert into amc.amc_blueprint(plugin_version_id,blueprint_key,version,content,effective_from)
select p.id,'AMC_CAT_MCQ','V8',
jsonb_build_object('total_items',150,'groups',jsonb_build_array(
 jsonb_build_object('key','ADULT_MEDICINE','proportion',0.30),
 jsonb_build_object('key','ADULT_SURGERY','proportion',0.20),
 jsonb_build_object('key','WOMENS_HEALTH','proportion',0.125),
 jsonb_build_object('key','CHILD_HEALTH','proportion',0.125),
 jsonb_build_object('key','MENTAL_HEALTH','proportion',0.125),
 jsonb_build_object('key','POPULATION_HEALTH','proportion',0.125)
),'rounding_rule','preserve exact total of 150; do not independently round all six proportions'),
now()
from amc.amc_plugin_version p
where p.version='1.0.0'
and not exists (select 1 from amc.amc_blueprint b where b.blueprint_key='AMC_CAT_MCQ' and b.version='V8');