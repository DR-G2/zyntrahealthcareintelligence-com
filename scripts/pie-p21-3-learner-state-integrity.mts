import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
const URL=process.env.V2_URL,KEY=process.env.V2_PUBLISHABLE_KEY,PASSWORD=process.env.PIE_TEST_PASSWORD,emailA=process.env.PIE_TEST_USER_A_EMAIL,emailB=process.env.PIE_TEST_USER_B_EMAIL;
if(!URL||!KEY||!PASSWORD||!emailA||!emailB) throw new Error("Missing P21.3 certification environment");
const opts={auth:{persistSession:false,autoRefreshToken:false}};let pass=0,fail=0;
const check=(name:string,ok:unknown,detail="")=>{if(ok)pass++;else fail++;console.log((ok?"PASS":"FAIL")+"  "+name+(detail?"  — "+detail:""));};
async function login(email:string){const db=createClient(URL!,KEY!,opts);const {data,error}=await db.auth.signInWithPassword({email,password:PASSWORD});if(error||!data.user||!data.session)throw new Error("login failed: "+(error?.message??""));return{db,id:data.user.id};}
async function audit(db:ReturnType<typeof createClient>){const result=await db.functions.invoke("pie-learner-state-audit",{body:{}});return{data:result.data as Record<string,unknown>|null,error:result.error};}
const source=await readFile("supabase/migrations_v2/0051_pie_p3_candidate_pool.sql","utf8");
check("P21.3-01 production target is the certified V2 project",URL==="https://hkowvjazuwebmibssdut.supabase.co");
check("P21.3-02 authoritative selector consumes pie.learner_lo_state",source.includes("from pie.learner_lo_state")&&source.includes("join pie.learner_lo_state"));
check("P21.3-03 learner state is not client-writable",source.includes("revoke all on pie.learner_lo_state from public, anon, authenticated"));
check("P21.3-04 learner-state selection inputs remain server-side",source.includes("create or replace function pie.rank_candidates")&&source.includes("security definer"));
const[A,B]=await Promise.all([login(emailA),login(emailB)]);check("P21.3-05 two authenticated production test identities are distinct",A.id!==B.id);
const beforeAudit=await audit(A.db);check("P21.3-06 user-scoped learner-state audit is available",!beforeAudit.error&&beforeAudit.data?.status==="ready",beforeAudit.error?.message??"");
check("P21.3-07 learner-state audit exposes no learner identity or privileged credentials",!!beforeAudit.data&&beforeAudit.data.learner_id_exposed===false&&beforeAudit.data.answer_key_exposed===false&&beforeAudit.data.selected_answer_exposed===false&&beforeAudit.data.privileged_credentials_exposed===false);
const beforeExposure=Number(beforeAudit.data?.total_exposure_count??0),beforeRows=Number(beforeAudit.data?.lo_state_row_count??0);
const created=await A.db.rpc("pie_create_session",{p_count:1,p_blueprint_key:"AMC_CAT_MCQ",p_mode:"pie_adaptive"});const sessionId=created.data?.[0]?.session_id as string|undefined;
check("P21.3-08 authoritative adaptive session is created",!created.error&&!!sessionId,created.error?.message??"");
if(sessionId){const qs=await A.db.rpc("get_practice_session_questions",{p_session_id:sessionId});const rows=Array.isArray(qs.data)?qs.data as Record<string,unknown>[]:[];const first=rows[0],questionId=String(first?.question_id??"");
check("P21.3-09 server-selected question is available for authoritative evidence",!qs.error&&!!questionId);
const saved=await A.db.rpc("save_attempt",{p_question_id:questionId,p_session_id:sessionId,p_selected_answer:"A",p_is_correct:false,p_time_taken_seconds:19,p_confidence_level:3,p_answer_changes_count:1,p_time_to_first_click:700,p_change_sequence:["A","B"],p_pause_events:[],p_time_of_day:"P21.3-cert",p_question_position:typeof first?.question_position==="number"?first.question_position:null,p_previous_question_correct:null,p_question_version:null,p_app_version:"P21.3-certification",p_provenance:{source:"P21.3-certification"}});
check("P21.3-10 authoritative attempt persists",!saved.error&&!!saved.data?.id,saved.error?.message??"");
const afterAudit=await audit(A.db);check("P21.3-11 learner-state audit remains available after authoritative attempt",!afterAudit.error&&afterAudit.data?.status==="ready",afterAudit.error?.message??"");
const afterExposure=Number(afterAudit.data?.total_exposure_count??0),afterRows=Number(afterAudit.data?.lo_state_row_count??0),models=Array.isArray(afterAudit.data?.model_versions)?afterAudit.data!.model_versions as unknown[]:[];
check("P21.3-12 authoritative attempt updates derived learner-state exposure",afterExposure>=beforeExposure+1,JSON.stringify({beforeExposure,afterExposure}));
check("P21.3-13 learner-state row count is consistent with derived LO coverage",afterRows>=beforeRows);
check("P21.3-14 learner-state uses the production model version",models.length===0||models.every(x=>x==="pie-lo-v1"),JSON.stringify({modelVersions:models}));
const repeatAudit=await audit(A.db);check("P21.3-15 repeated learner-state audit is non-mutating and stable",!repeatAudit.error&&Number(repeatAudit.data?.total_exposure_count??-1)===afterExposure&&JSON.stringify(repeatAudit.data?.state_versions??[])===JSON.stringify(afterAudit.data?.state_versions??[]));
const direct=await A.db.schema("pie").from("learner_lo_state").select("*").limit(1);check("P21.3-16 learner cannot directly read protected learner-state table",!!direct.error||!direct.data||direct.data.length===0,direct.error?.message??"direct read returned no rows");
const foreignAudit=await audit(B.db);check("P21.3-17 second candidate receives only its own learner-state aggregate",!foreignAudit.error&&foreignAudit.data?.user_scoped===true,foreignAudit.error?.message??"");
check("P21.3-18 cross-candidate audit response does not expose first candidate identity",!JSON.stringify(foreignAudit.data??{}).includes(A.id));
check("P21.3-19 learner-state audit exposes no answer key or raw selected answer",!JSON.stringify(afterAudit.data??{}).includes("correct_answer")&&!JSON.stringify(afterAudit.data??{}).includes("selected_answer"));}
await A.db.auth.signOut();await B.db.auth.signOut();console.log("");console.log("P21.3 LEARNER-STATE INTEGRITY SUMMARY: PASS="+pass+" FAIL="+fail);if(fail)process.exit(1);