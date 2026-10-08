import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
const URL=process.env.V2_URL,KEY=process.env.V2_PUBLISHABLE_KEY,PASSWORD=process.env.PIE_TEST_PASSWORD,emailA=process.env.PIE_TEST_USER_A_EMAIL,emailB=process.env.PIE_TEST_USER_B_EMAIL;
if(!URL||!KEY||!PASSWORD||!emailA||!emailB)throw new Error("Missing P21.4 certification environment");
const opts={auth:{persistSession:false,autoRefreshToken:false}};let pass=0,fail=0;
const check=(n:string,o:unknown,d="")=>{if(o)pass++;else fail++;console.log((o?"PASS":"FAIL")+"  "+n+(d?"  — "+d:""));};
async function login(email:string){const db=createClient(URL!,KEY!,opts);const {data,error}=await db.auth.signInWithPassword({email,password:PASSWORD});if(error||!data.user||!data.session)throw new Error("login failed");return{db,id:data.user.id};}
async function audit(db:ReturnType<typeof createClient>){const r=await db.functions.invoke("pie-learner-state-audit",{body:{}});return{data:r.data as Record<string,unknown>|null,error:r.error};}
const selector=await readFile("supabase/migrations_v2/0051_pie_p3_candidate_pool.sql","utf8");\nconst traceApi=await A?.db?.rpc?.("get_my_pie_decision_traces").catch(()=>null);
check("P21.4-01 certified production target",URL==="https://hkowvjazuwebmibssdut.supabase.co");
check("P21.4-02 authoritative selector consumes learner state",selector.includes("pie.learner_lo_state")&&selector.includes("pie-select/p3.0"));
check("P21.4-03 selector does not consume P12 shadow inference",!selector.includes("inference_shadow"));
check("P21.4-04 selector records authoritative decision traces",selector.includes("insert into pie.decision_trace"));
const[A,B]=await Promise.all([login(emailA),login(emailB)]);check("P21.4-05 authenticated candidates are distinct",A.id!==B.id);
const before=await audit(A.db);check("P21.4-06 baseline learner-state audit available",!before.error&&before.data?.status==="ready",before.error?.message??"");
const beforeExposure=Number(before.data?.total_exposure_count??-1);
const created=await A.db.rpc("pie_create_session",{p_count:1,p_blueprint_key:"AMC_CAT_MCQ",p_mode:"pie_adaptive"});const sid=created.data?.[0]?.session_id as string|undefined;
check("P21.4-07 authoritative adaptive session created",!created.error&&!!sid,created.error?.message??"");
if(sid){
const qs=await A.db.rpc("get_practice_session_questions",{p_session_id:sid});const rows=Array.isArray(qs.data)?qs.data as Record<string,unknown>[]:[];const first=rows[0];const q1=String(first?.question_id??"");
check("P21.4-08 initial question is server-selected",!qs.error&&!!q1);
const t0=await A.db.rpc("get_my_pie_decision_traces");const traces0=Array.isArray(t0.data)?t0.data as Record<string,unknown>[]:[];const initial=traces0.find(t=>t.session_id===sid&&t.decision_type==="SESSION_BUILD");
check("P21.4-09 initial decision trace exists",!t0.error&&!!initial,t0.error?.message??"");
const saved=await A.db.rpc("save_attempt",{p_question_id:q1,p_session_id:sid,p_selected_answer:"A",p_is_correct:false,p_time_taken_seconds:23,p_confidence_level:4,p_answer_changes_count:1,p_time_to_first_click:800,p_change_sequence:["A","B"],p_pause_events:[],p_time_of_day:"P21.4-cert",p_question_position:typeof first?.question_position==="number"?first.question_position:null,p_previous_question_correct:null,p_question_version:null,p_app_version:"P21.4-certification",p_provenance:{source:"P21.4-certification"}});
check("P21.4-10 authoritative attempt persists before adaptation",!saved.error&&!!saved.data?.id,saved.error?.message??"");
const after=await audit(A.db);const afterExposure=Number(after.data?.total_exposure_count??-1);
check("P21.4-11 learner state reflects the authoritative attempt",!after.error&&after.data?.status==="ready"&&afterExposure===beforeExposure+1,JSON.stringify({beforeExposure,afterExposure}));
const next=await A.db.rpc("pie_next_question",{p_session_id:sid});const nr=Array.isArray(next.data)?next.data[0] as Record<string,unknown>|undefined:undefined;const q2=String(nr?.question_id??""),decisionId=String(nr?.decision_id??"");
check("P21.4-12 next question is selected only by authoritative server",!next.error&&!!q2&&!!decisionId,next.error?.message??"");
const t1=await A.db.rpc("get_my_pie_decision_traces");const all=Array.isArray(t1.data)?t1.data as Record<string,unknown>[]:[];const sessionTraces=all.filter(t=>t.session_id===sid);const nextTrace=sessionTraces.find(t=>t.id===decisionId);
check("P21.4-13 next decision trace resolves after the attempt",!!nextTrace&&!!initial&&String(nextTrace.created_at)>String(initial.created_at));
check("P21.4-14 next decision trace uses certified authoritative selector",!!nextTrace&&nextTrace.source==="authoritative"&&nextTrace.policy_version==="pie-select/p3.0"&&nextTrace.model_version==="pie-select/p3.0-authoritative");
check("P21.4-15 next trace points to the returned question",!!nextTrace&&nextTrace.question_id===q2);
const selected=nextTrace?.selected_action as Record<string,unknown>|undefined;
check("P21.4-16 next trace contains a server-selected LO action",!!selected&&typeof selected.lo_id==="string"&&selected.lo_id.length>0);
check("P21.4-17 authoritative trace schema retains server-side learner-state snapshot",selector.includes("state_snapshot")&&selector.includes("evidence_snapshot"));
const qs2=await A.db.rpc("get_practice_session_questions",{p_session_id:sid});const rows2=Array.isArray(qs2.data)?qs2.data as Record<string,unknown>[]:[];
check("P21.4-18 session contains both server-selected questions",!qs2.error&&rows2.some(q=>q.question_id===q1)&&rows2.some(q=>q.question_id===q2));
const foreign=await B.db.rpc("get_my_pie_decision_traces");const fb=Array.isArray(foreign.data)?foreign.data as Record<string,unknown>[]:[];
check("P21.4-19 second candidate cannot observe first candidate's adaptation traces",!foreign.error&&!fb.some(t=>t.session_id===sid));
check("P21.4-20 no privileged credential material in adaptation trace response",!JSON.stringify(t1.data??{}).includes("service_role")&&!JSON.stringify(t1.data??{}).includes("access_token"));
}
await A.db.auth.signOut();await B.db.auth.signOut();
console.log("");console.log("P21.4 STATE-TO-SELECTION INTEGRITY SUMMARY: PASS="+pass+" FAIL="+fail);if(fail)process.exit(1);