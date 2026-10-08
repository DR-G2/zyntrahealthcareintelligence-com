import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors={
  "Access-Control-Allow-Origin":Deno.env.get('PIE_ALLOWED_ORIGIN')??'https://www.zyntrahealthcareintelligence.com',
  "Access-Control-Allow-Headers":'authorization, x-client-info, apikey, content-type'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(req.method!=='POST') return json({error:'method_not_allowed'},405);
  const auth=req.headers.get('Authorization');
  if(!auth) return json({error:'missing_authorization'},401);

  const url=Deno.env.get('SUPABASE_URL');
  const anon=Deno.env.get('SUPABASE_ANON_KEY');
  if(!url||!anon) return json({error:'server_configuration_error'},500);

  const client=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:ue}=await client.auth.getUser();
  if(ue||!user) return json({error:'unauthorized'},401);

  const {error:re}=await client.rpc('rebuild_my_pie_inference');
  if(re) return json({error:'inference_rebuild_failed',detail:re.message},500);

  const {data,stateError}=await client.rpc('get_my_pie_inference');
  if(stateError) return json({error:'inference_read_failed',detail:stateError.message},500);

  return json({status:'completed',authoritative:true,model_version:'pie-inference-v2.0',user_id:user.id,inference:data});
});
