import {api} from '../server/api.mjs';
import {member} from '../src/domain.mjs';
import {postgresDatabase} from './postgres-adapter.mjs';
import {hashCode,issueSession,verifySession} from './auth.mjs';
import {publicProfileState} from '../server/profiles.mjs';

const allowedOrigins=['https://kayceyu.github.io','http://127.0.0.1:4173'];
function response(data,status=200,origin=null,extraHeaders={}) {
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(origin&&allowedOrigins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{}),...extraHeaders}});
}
export function createHandler(client,serviceKey) {
 const db=postgresDatabase(client);
 return async request=>{
  const origin=request.headers.get('origin');
  if(origin&&!allowedOrigins.includes(origin))return response({error:'请求来源未获授权'},403);
  const url=new URL(request.url);url.pathname=url.pathname.replace(/^\/(?:functions\/v1\/)?cougeju(?=\/|$)/,'');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{}),'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Member-Id, Authorization','Access-Control-Max-Age':'600'}});
  try{
   if(url.pathname==='/api/identity'&&request.method==='POST'){
    let body;try{body=await request.json();}catch{return response({error:'请填写四位数字口令'},400,origin);}
    if(body?.memberId===null)return response({memberId:null},200,origin);
    const code=typeof body?.accessCode==='string'?body.accessCode.trim():'';
    if(!/^[0-9]{4}$/.test(code))return response({error:'请填写四位数字口令'},400,origin);
    const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown';
    const {data,error}=await client.rpc('cg_authenticate_member',{input_code:code,client_key:await hashCode(ip)});
    if(error)throw new Error('Member authentication unavailable');
    if(data?.error==='rate_limited'){
     const retryAfter=Math.max(1,Number(data.retryAfter)||900);
     return response({error:`尝试次数过多，请在 ${Math.ceil(retryAfter/60)} 分钟后重试`},429,origin,{'Retry-After':String(retryAfter)});
    }
    if(!member(data?.memberId))return response({error:'口令不正确，请重新输入'},401,origin);
    return response({memberId:data.memberId,access_token:await issueSession(data.memberId,serviceKey)},200,origin);
   }
   const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
   const actor=token?await verifySession(token,serviceKey):null;
   if(!actor||!member(actor)){
    if(url.pathname==='/api/state'&&request.method==='GET')return response(await publicProfileState(db),200,origin);
    if(!(request.method==='GET'&&/^\/api\/profiles\/[^/]+\/avatar$/.test(url.pathname)))return response({error:'请先输入个人口令登录'},401,origin);
   }
   const headers=new Headers(request.headers);headers.delete('cookie');headers.delete('X-Member-Id');if(actor&&member(actor))headers.set('X-Member-Id',actor);
   const forwarded=new Request(url,{method:request.method,headers,...(!['GET','HEAD'].includes(request.method)?{body:await request.arrayBuffer()}:{})});
   return await api(forwarded,db,{allowedOrigins});
  }catch(error){console.error('Cougeju request failed',error instanceof Error?error.message:'Unknown error');return response({error:'共享服务暂时无法完成请求，请稍后重试'},500,origin);}
 };
}
