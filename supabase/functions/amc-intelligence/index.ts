import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const O=Deno.env.get("AMC_ALLOWED_ORIGIN")??"https://www.zyntrahealthcareintelligence.com";
const H={"Access-Control-Allow-Origin":O,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
const J=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...H,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H}); if(req.method!=="POST")return J({error:"method_not_allowed"},405);
 const auth=req.headers.get("Authorization");if(!auth)return J({error:"missing_authorization"},401);
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anon=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!service||!anon)return J({error:"server_configuration_error"},500);
 const uc=createClient(url,anon,{global:{headers:{Authorization:auth}}}),sc=createClient(url,service);
 const {data:{user},error:ae}=await uc.auth.getUser();if(ae||!user)return J({error:"unauthorized"},401);
 const b=await req.json().catch(()=>null) as Record<string,unknown>|null;if(!b)return J({error:"invalid_request"},400);
 if(b.user_id&&b.user_id!==user.id)return J({error:"user_scope_violation"},403);
 const mode=b.exam_mode==="CLINICAL"?"CLINICAL":"MCQ", action=b.action;
 const {data:p}=await sc.from("amc_plugin_version").select("id,plugin_code,plugin_version,status,blueprint_version,environment_version").eq("plugin_code","AMC").eq("plugin_version","1.0.0").maybeSingle();
 if(!p)return J({error:"amc_plugin_unavailable"},404);
 if(action==="get_readiness"){const {data,error}=await uc.rpc("rebuild_my_amc_readiness",{p_exam_mode:mode});if(error)return J({error:"readiness_evaluation_failed",detail:error.message},500);return J(data);}
 if(action==="get_summary"){const {data:e}=await sc.from("amc_exam_environment_v1").select("environment_code,environment_version,exam_mode,status").eq("plugin_version_id",p.id).eq("exam_mode",mode).order("created_at",{ascending:false}).limit(1).maybeSingle();return J({plugin:"AMC",pluginVersion:p.plugin_version,status:p.status,environmentCode:e?.environment_code??null,examMode:mode,readiness:{probability:null,index:null,uncertainty:null,status:"INSUFFICIENT_EVIDENCE",probabilityStatus:"NOT_CALIBRATED"}});}
 if(action==="get_blueprint"){const {data,error}=await sc.from("amc_blueprint").select("exam_mode,patient_group,task_domain,proportion,item_target").eq("plugin_version_id",p.id).eq("exam_mode",mode);if(error)return J({error:"blueprint_query_failed"},500);return J({plugin:"AMC",pluginVersion:p.plugin_version,examMode:mode,blueprint:data??[]});}
 return J({error:"unsupported_action"},400);
});