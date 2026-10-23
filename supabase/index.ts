import {createClient} from 'npm:@supabase/supabase-js@2';
import {api} from '../server/api.mjs';
import {member} from '../src/domain.mjs';
import {postgresDatabase} from './postgres-adapter.mjs';
import {hashCode,issueSession,verifySession} from './auth.mjs';

const allowedOrigins=['https://kayceyu.github.io','http://127.0.0.1:4173'];
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const client=createClient(Deno.env.get('SUPABASE_URL')!,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const db=postgresDatabase(client);
function response(data:unknown,status=200,origin:string|null=null){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(origin&&allowedOrigins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})}});}
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('origin');
 if(origin&&!allowedOrigins.includes(origin))return response({error:'请求来源未获授权'},403);
 const url=new URL(request.url);url.pathname=url.pathname.replace(/^\/(?:functions\/v1\/)?cougeju(?=\/|$)/,'');
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{}),'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Member-Id, Authorization','Access-Control-Max-Age':'600'}});
 try{
  if(url.pathname==='/api/identity'&&request.method==='POST'){
   const body=await request.json();if(body.memberId===null)return response({memberId:null},200,origin);
   if(!member(body.memberId))return response({error:'请从六位伙伴中选择身份'},400,origin);
   const {data,error}=await client.from('cg_access_config').select('secret_hash').eq('id',true).single();
   if(error||!data)return response({error:'小队访问口令尚未配置'},503,origin);
   const supplied=await hashCode(typeof body.accessCode==='string'?body.accessCode.trim():'');
   if(supplied!==data.secret_hash)return response({error:'小队口令不正确，请向活动组织者获取'},401,origin);
   return response({memberId:body.memberId,access_token:await issueSession(body.memberId,serviceKey)},200,origin);
  }
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  const actor=token?await verifySession(token,serviceKey):null;
  if(!actor||!member(actor)){
   if(url.pathname==='/api/state'&&request.method==='GET')return response({memberId:null,events:[],rsvps:[],comments:[],expenses:[],changes:[],acks:[]},200,origin);
   return response({error:'请先输入小队口令并选择身份'},401,origin);
  }
  const headers=new Headers(request.headers);headers.delete('cookie');headers.set('X-Member-Id',actor);
  const forwarded=new Request(url,{method:request.method,headers,...(!['GET','HEAD'].includes(request.method)?{body:await request.arrayBuffer()}:{})});
  return await api(forwarded,db,{allowedOrigins});
 }catch(error){console.error('Cougeju request failed',error instanceof Error?error.message:'Unknown error');return response({error:'共享服务暂时无法完成请求，请稍后重试'},500,origin);}
});
