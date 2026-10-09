import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
const URL=process.env.V2_URL,KEY=process.env.V2_PUBLISHABLE_KEY,PASSWORD=process.env.PIE_TEST_PASSWORD,emailA=process.env.PIE_TEST_USER_A_EMAIL,emailB=process.env.PIE_TEST_USER_B_EMAIL;
if(!URL||!KEY||!PASSWORD||!emailA||!emailB)throw new Error("Missing P21.4 certification environment");
const opts={auth:{persistSession:false,autoRefreshToken:false}};let pass=0,fail=0;
const check=(n:string,o:unknown,d="")=>{if(o)pass++;else fail++;console.log((o?"PASS":"FAIL")+"  "+n+(d?"  — "+d:""));};
async function login(email:string){const db=createClient(URL!,KEY!,opts);const {data,error}=await db.auth.signInWithPassword({email,password:PASSWORD});if(error||!data.user||!data.session)throw new Error("login failed");return{db,id:data.user.id};}
async function audit(db:ReturnType<typeof createClient>){const r=await db.functions.invoke("pie-learner-state-audit",{body:{}});return{data:r.data as Record<string,unknown>|null,error:r.error};}
const selector=await readFile("supabase/migrations_v2/0051_pie_p3_candidate_pool.sql","utf8");