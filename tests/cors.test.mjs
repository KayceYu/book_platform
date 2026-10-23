import {test} from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../server/api.mjs';
const origin='https://kayceyu.github.io';
test('Pages preflight permits only the configured origin and explicit headers',async()=>{
  const req=new Request('https://api.example.test/api/state',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Headers':'content-type,x-member-id'}});
  const allowed=await api(req,null,{allowedOrigins:[origin]});
  assert.equal(allowed.status,204);assert.equal(allowed.headers.get('access-control-allow-origin'),origin);
  assert.match(allowed.headers.get('access-control-allow-headers'),/X-Member-Id/);
  assert.equal(allowed.headers.get('access-control-allow-credentials'),null);
  const rejected=await api(req,null,{allowedOrigins:['https://other.example.test']});assert.equal(rejected.status,403);
  assert.equal(rejected.headers.get('access-control-allow-origin'),null);
});
test('cross-origin identity selection still validates the fixed member list',async()=>{
  const request=new Request('https://api.example.test/api/identity',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({memberId:'four'})});
  const response=await api(request,null,{allowedOrigins:[origin]});assert.equal(response.status,200);assert.equal((await response.json()).memberId,'four');assert.equal(response.headers.get('access-control-allow-origin'),origin);
});
