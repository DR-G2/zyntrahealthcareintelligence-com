import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const KEY=Deno.env.get('RESEND_API_KEY'),FROM=Deno.env.get('SECURITY_ALERT_FROM_EMAIL'),TO=(Deno.env.get('SECURITY_ADMIN_EMAILS')||'').split(',').map(v=>v.trim()).filter(Boolean),SECRET=Deno.env.get('SECURITY_EMAIL_WORKER_SECRET');
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 if(!SECRET||req.headers.get('x-zyntra-security-worker')!==SECRET)return new Response('Unauthorized',{status:401});
 if(!KEY||!FROM||!TO.length)return new Response(JSON.stringify({ok:false,error:'Email provider is not configured'}),{status:503,headers:{'content-type':'application/json'}});
 const {data:alerts,error}=await db.schema('pie').from('security_alert').select('id,incident_id,severity,title,category,summary').eq('notification_state','pending').contains('notification_channels',['admin_email']).order('created_at',{ascending:true}).limit(20);
 if(error)return new Response(JSON.stringify({ok:false,error:error.message}),{status:500});
 let sent=0,failed=0;
 for(const alert of alerts??[]){try{
  const {data:i}=await db.schema('pie').from('security_incident').select('id,user_id,event_count,screenshot_count,first_event_at,last_event_at').eq('id',alert.incident_id).single();
  const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},body:JSON.stringify({from:FROM,to:TO,subject:'['+String(alert.severity).toUpperCase()+'] Zyntra security alert: '+alert.category,html:'<h2>'+esc(alert.title)+'</h2><p><b>Severity:</b> '+esc(alert.severity)+'</p><p><b>Category:</b> '+esc(alert.category)+'</p><p><b>Summary:</b> '+esc(alert.summary)+'</p><hr><p><b>Incident:</b> '+esc(alert.incident_id)+'</p><p><b>User:</b> '+esc(i?.user_id)+'</p><p><b>Events:</b> '+esc(i?.event_count)+'</p><p><b>Screenshots:</b> '+esc(i?.screenshot_count)+'</p><p><b>First:</b> '+esc(i?.first_event_at)+'</p><p><b>Last:</b> '+esc(i?.last_event_at)+'</p><p>Credentials, passwords, refresh tokens and access tokens are excluded.</p>'})});
  if(!res.ok)throw new Error(await res.text());
  const result=await res.json();
  await db.schema('pie').from('security_alert').update({notification_state:'sent',sent_at:new Date().toISOString(),provider_message_id:result?.id??null}).eq('id',alert.id);sent++;
 }catch{await db.schema('pie').from('security_alert').update({notification_state:'failed'}).eq('id',alert.id);failed++;}}
 return new Response(JSON.stringify({ok:failed===0,processed:(alerts??[]).length,sent,failed}),{headers:{'content-type':'application/json'}});
});