import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const SECRET=Deno.env.get('RESEND_WEBHOOK_SECRET')||'';
function b64(s:string){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
function hex(a:ArrayBuffer){return Array.from(new Uint8Array(a)).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function verify(raw:string,id:string,ts:string,sig:string){
 if(!SECRET||!id||!ts||!sig||Math.abs(Date.now()/1000-Number(ts))>300)return false;
 const key=b64(SECRET.replace(/^whsec_/,''));
 const data=new TextEncoder().encode(id+'.'+ts+'.'+raw);
 const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=hex(await crypto.subtle.sign('HMAC',k,data));
 return sig.split(' ').some(v=>v.split(',')[1]===mac);
}
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const raw=await req.text(),id=req.headers.get('svix-id')||req.headers.get('webhook-id')||'',ts=req.headers.get('svix-timestamp')||req.headers.get('webhook-timestamp')||'',sig=req.headers.get('svix-signature')||req.headers.get('webhook-signature')||'';
 if(!(await verify(raw,id,ts,sig)))return new Response('Invalid signature',{status:401});
 let body:any;try{body=JSON.parse(raw)}catch{return new Response('Invalid JSON',{status:400});}
 const eventType=String(body.type||body.event||'unknown'),messageId=String(body.data?.email_id||body.data?.emailId||body.data?.id||'');
 await db.schema('pie').rpc('apply_notification_delivery',{p_provider:'resend',p_provider_event_id:id,p_provider_message_id:messageId,p_event_type:eventType,p_payload:body});
 return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}});
});