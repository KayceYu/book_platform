import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/handler.mjs';
import {verifySession,issueSession} from '../supabase/auth.mjs';

// Synthetic credentials only; production mappings are provisioned privately.
const identities=['chang','cha','four','xia','fish','red'];
const codes=['0008','8001','8002','8003','8004','8005'];
const secret='test-service-key';
const request=(body,headers={})=>new Request('https://example.test/functions/v1/cougeju/api/identity',{method:'POST',headers:{Origin:'https://kayceyu.github.io','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
function fixture(authenticate) {
 const calls=[];
 const client={async rpc(name,args){calls.push({name,args});if(name==='cg_authenticate_member'){
  if(authenticate)return {data:authenticate(args),error:null};
  const index=codes.indexOf(args.input_code);return {data:index<0?{error:'invalid_code'}:{memberId:identities[index]},error:null};
 }return {data:{results:[],meta:{changes:0}},error:null};}};
 return {handle:createHandler(client,secret),calls};
}
test('six personal codes identify members without a nickname and preserve a leading zero',async()=>{
 const {handle,calls}=fixture();
 for(let index=0;index<codes.length;index++){
  const response=await handle(request({accessCode:codes[index]}));assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.memberId,identities[index]);
  assert.equal(await verifySession(result.access_token,secret),identities[index]);
  assert.deepEqual(Object.keys(result).sort(),['access_token','memberId']);
 }
 assert.equal(calls[0].args.input_code,'0008');assert.match(calls[0].args.client_key,/^[a-f0-9]{64}$/);
});
test('a submitted nickname cannot override the identity from the code or signed session',async()=>{
 const {handle}=fixture();const response=await handle(request({accessCode:codes[0],memberId:'fish'}));
 const login=await response.json();assert.equal(login.memberId,'chang');
 const state=await handle(new Request('https://example.test/cougeju/api/state',{headers:{Authorization:'Bearer '+login.access_token,'X-Member-Id':'fish',Cookie:'memberId=fish'}}));
 assert.equal((await state.json()).memberId,'chang');
});
test('wrong codes, malformed input and rate limits never issue a session',async()=>{
 const {handle,calls}=fixture();
 for(const code of ['',8,'abcd','12345'])assert.equal((await handle(request({accessCode:code}))).status,400);
 assert.equal(calls.length,0);
 const wrong=await handle(request({accessCode:'9999'}));assert.equal(wrong.status,401);assert.equal((await wrong.json()).access_token,undefined);
 const limited=fixture(()=>({error:'rate_limited',retryAfter:420}));const result=await limited.handle(request({accessCode:codes[0]}));
 assert.equal(result.status,429);assert.equal(result.headers.get('Retry-After'),'420');assert.equal((await result.json()).access_token,undefined);
});
test('logout clears identity and anonymous requests cannot use a member header to authenticate',async()=>{
 const {handle}=fixture();assert.deepEqual(await (await handle(request({memberId:null}))).json(),{memberId:null});
 const state=await handle(new Request('https://example.test/cougeju/api/state',{headers:{'X-Member-Id':'fish'}}));assert.equal((await state.json()).memberId,null);
 const denied=await handle(new Request('https://example.test/cougeju/api/events',{method:'POST',headers:{'X-Member-Id':'fish'},body:'{}'}));assert.equal(denied.status,401);
});
test('sessions signed before the individual-code upgrade are rejected',async()=>{
 const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({sub:'fish',aud:'cougeju',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('cougeju-session-v1:'+secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const message=header+'.'+payload;const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message))).toString('base64url');
 assert.equal(await verifySession(message+'.'+signature,secret),null);
 assert.equal(await verifySession(await issueSession('fish',secret),secret),'fish');
});
