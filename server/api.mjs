import { MEMBERS, member, STATUS, RSVP, splitExpense } from '../src/domain.mjs';
import { seed } from './seed.mjs';
import {listProfiles,profileFields,avatarBytes,publicProfileState} from './profiles.mjs';
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const fail = (message,status=400) => { const e=new Error(message);e.status=status;throw e; };
const text = (value,max=500) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const uid = () => crypto.randomUUID();
const stamp = () => new Date().toISOString();
const actorFrom = req => { const id=req.headers.get('x-member-id')||(req.headers.get('cookie')||'').match(/(?:^|;\s*)cg_member=([^;]+)/)?.[1];return member(id)?.id||null; };
const allData = async (db,table) => (await db.prepare(`SELECT data FROM ${table}`).all()).results.map(r=>JSON.parse(r.data));
const getEvent = async (db,id) => { const r=await db.prepare('SELECT data,version FROM events WHERE id=?').bind(id).first(); if(!r)fail('活动不存在',404);return {...JSON.parse(r.data),version:r.version}; };
function validateEvent(input, creator) {
  const e={...input,title:text(input.title,80),description:text(input.description,4000),creator};
  if(!e.title)fail('请填写活动名称');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date||'')||!/^\d{4}-\d{2}-\d{2}$/.test(e.endDate||''))fail('请选择完整的活动日期');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.start||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.end||''))fail('请填写有效的起止时间');
  const start=Date.parse(`${e.date}T${e.start}:00+08:00`),end=Date.parse(`${e.endDate}T${e.end}:00+08:00`);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)fail('结束时间必须晚于开始时间，跨天活动请调整结束日期');
  if(!['CNY','HKD'].includes(e.currency))fail('请选择支持的币种');
  if(!Object.keys(STATUS).includes(e.status))fail('活动状态无效');
  if(!Array.isArray(e.invitees)||!e.invitees.length||e.invitees.some(id=>!member(id)))fail('请从六人名单中选择参与人员');
  e.invitees=[...new Set(e.invitees)];
  if(!e.invitees.includes(creator))e.invitees.push(creator);
  if(!Array.isArray(e.stages)||!e.stages.length||e.stages.length>16)fail('请安排 1–16 个活动环节');
  if(new Set(e.stages.map(s=>s.id)).size!==e.stages.length)fail('环节编号重复');
  e.stages=e.stages.map(s=>{ if(!s.id||typeof s.id!=='string'||!text(s.title,80))fail('请填写每个环节的名称');const a=Date.parse(`${s.date||e.date}T${s.start}:00+08:00`), b=Date.parse(`${s.endDate||s.date||e.date}T${s.end}:00+08:00`);if(!Number.isFinite(a)||!Number.isFinite(b)||a<start||b>end||b<=a)fail(`「${s.title}」的起止时间需在活动范围内，且结束晚于开始`); if(s.leader&&!member(s.leader))fail('负责人需从六人名单选择');if(s.mapUrl&&!/^https:\/\//.test(s.mapUrl))fail('地图链接请使用 https 地址');return {...s,title:text(s.title,80),budget:Math.max(0,Math.round(Number(s.budget)||0)),capacity:Math.max(0,Math.min(100,Number(s.capacity)||0))};});
  if(e.deadline){const d=Date.parse(e.deadline+'+08:00');if(!Number.isFinite(d)||d>start)fail('报名截止时间不得晚于活动开始时间');}
  return e;
}
function changeSummary(old,e) { const changes=[];if(old.title!==e.title)changes.push('活动名称');if(['date','endDate','start','end'].some(k=>old[k]!==e[k]))changes.push('活动时间');if(JSON.stringify(old.stages)!==JSON.stringify(e.stages))changes.push('行程、地点或预约信息');if(old.status!==e.status)changes.push(`状态：${STATUS[e.status]}`);if(JSON.stringify(old.invitees)!==JSON.stringify(e.invitees))changes.push('邀请名单');return changes.length?changes.join('、'):'活动说明与安排'; }
function criticalChange(old,next) { const stageKeys=['id','type','title','date','endDate','start','end','location','branch','address','meetup','route'];const project=s=>Object.fromEntries(stageKeys.map(k=>[k,s[k]||'']));return ['title','date','endDate','start','end','status'].some(k=>old[k]!==next[k])||JSON.stringify(old.invitees)!==JSON.stringify(next.invitees)||JSON.stringify(old.stages.map(project))!==JSON.stringify(next.stages.map(project)); }
async function handleApi(request,db,{allowedOrigins=[]}={}) {
  try { const url=new URL(request.url), path=url.pathname, method=request.method, actor=actorFrom(request);
    if(method!=='GET'&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin&&!allowedOrigins.includes(request.headers.get('origin')))fail('请求来源不一致',403);
    if(path==='/api/identity'&&method==='POST'){const b=await request.json();if(b.memberId!==null&&!member(b.memberId))fail('请从六位成员中选择身份');return json({memberId:b.memberId},200,{'Set-Cookie':`cg_member=${b.memberId||''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${b.memberId?31536000:0}${url.protocol==='https:'?'; Secure':''}`});}
    if(path==='/api/state'&&method==='GET'&&!actor)return json(await publicProfileState(db));
    await seed(db);
    if(path==='/api/state'&&method==='GET'){const [events,rsvps,comments,expenses,changes,acks]=await Promise.all([allData(db,'events'),allData(db,'rsvps'),allData(db,'comments'),allData(db,'expenses'),allData(db,'changes'),db.prepare('SELECT event_id as eventId, member_id as memberId, version FROM acknowledgements').all()]);const visible=events.filter(e=>e.status!=='draft'||e.creator===actor), ids=new Set(visible.map(e=>e.id));return json({memberId:actor,events:visible,rsvps:rsvps.filter(r=>ids.has(r.eventId)).map(r=>{const event=visible.find(e=>e.id===r.eventId);return actor===r.memberId||actor===event.creator||actor===event.stages.find(s=>s.id===r.stageId)?.leader?r:{...r,needs:''};}),comments:comments.filter(r=>ids.has(r.eventId)),expenses:expenses.filter(r=>ids.has(r.eventId)),changes:changes.filter(r=>ids.has(r.eventId)),acks:acks.results.filter(a=>ids.has(a.eventId)),profiles:actor?await listProfiles(db):[]});}
    const avatarMatch=path.match(/^\/api\/profiles\/([^/]+)\/avatar$/);
    if(avatarMatch&&method==='GET'){
      if(!member(avatarMatch[1]))fail('成员不存在',404);
      const row=await db.prepare('SELECT value FROM app_meta WHERE key=?').bind('avatar:'+avatarMatch[1]).first();
      if(!row)fail('尚未设置头像',404);
      return new Response(avatarBytes(row.value),{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
    }
    if(!actor)fail('请先选择你的身份',401);
    const body=method==='GET'?{}:await request.json();
    if(path==='/api/profile'&&method==='PUT'){
      if(body.memberId&&body.memberId!==actor)fail('只能修改自己的资料',403);
      const fields=profileFields(body),key='profile:'+actor;
      const old=await db.prepare('SELECT value FROM app_meta WHERE key=?').bind(key).first(),previous=old?JSON.parse(old.value):null;
      if((body.version??null)!==(previous?.version??null))fail('资料已在其他设备更新，请刷新后再修改',409);
      const version=uid(),avatarChanged=body.avatar!==undefined;
      const profile={memberId:actor,...fields,version,avatarVersion:avatarChanged?(body.avatar?version:null):(previous?.avatarVersion||null),updatedAt:stamp()};
      const value=JSON.stringify(profile);
      const statements=[old?db.prepare('UPDATE app_meta SET value=? WHERE key=? AND value=?').bind(value,key,old.value):db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING').bind(key,value)];
      if(avatarChanged)statements.push(body.avatar===null?db.prepare('DELETE FROM app_meta WHERE key=? AND (SELECT value FROM app_meta WHERE key=?)=?').bind('avatar:'+actor,key,value):db.prepare('INSERT INTO app_meta(key,value) SELECT ?,? WHERE (SELECT value FROM app_meta WHERE key=?)=? ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('avatar:'+actor,body.avatar,key,value));
      const saved=await db.batch(statements);if(!saved[0]?.meta.changes)fail('资料已更新，请刷新后再修改',409);
      return json({profile});
    }
    if(path==='/api/events'&&method==='POST'){const e=validateEvent(body,actor);e.id=uid();e.version=1;e.isDemo=false;e.createdAt=stamp();await db.prepare('INSERT INTO events(id,data,version,created_at) VALUES(?,?,?,?)').bind(e.id,JSON.stringify(e),1,e.createdAt).run();return json({id:e.id},201);}
    const match=path.match(/^\/api\/events\/([^/]+)(?:\/(.*))?$/); if(!match)fail('接口不存在',404);
    const [,id,action]=match,e=await getEvent(db,id);if(e.status==='draft'&&e.creator!==actor)fail('该活动尚未发布',403);
    if(!action&&method==='PUT'){if(e.creator!==actor)fail('只有组织者可以修改正式安排',403);if(body.version!==e.version)fail('安排已被更新，请刷新后再修改',409);const next=validateEvent({...body,id:e.id,isDemo:e.isDemo,createdAt:e.createdAt,version:e.version+1},e.creator);next.confirmationVersion=criticalChange(e,next)?next.version:(e.confirmationVersion||e.version);const change={id:uid(),eventId:id,memberId:actor,version:next.version,text:changeSummary(e,next),createdAt:stamp()};const result=await db.prepare('UPDATE events SET data=?,version=? WHERE id=? AND version=?').bind(JSON.stringify(next),next.version,id,e.version).run();if(!result.meta.changes)fail('安排已被更新，请刷新后重试',409);await db.prepare('INSERT INTO changes(id,event_id,data,created_at) VALUES(?,?,?,?)').bind(change.id,id,JSON.stringify(change),change.createdAt).run();return json({ok:true});}
    if(!action&&method==='DELETE'){if(e.creator!==actor&&!e.isDemo)fail('只有组织者可以删除活动',403);await db.batch(['rsvps','comments','expenses','acknowledgements','changes'].map(t=>db.prepare(`DELETE FROM ${t} WHERE event_id=?`).bind(id)).concat(db.prepare('DELETE FROM events WHERE id=?').bind(id)));return json({ok:true});}
    if(action==='rsvp'&&method==='POST'){
      if(!e.invitees.includes(actor))fail('你尚未在邀请名单中，请联系组织者',403);
      if(['draft','cancelled','ended'].includes(e.status))fail('当前活动已关闭报名');
      if(body.version!==e.version)fail('安排有更新，请先刷新并阅读最新版本',409);
      if(!Array.isArray(body.stages)||body.stages.length!==e.stages.length||new Set(body.stages.map(s=>s.stageId)).size!==e.stages.length)fail('请确认每个环节的参加状态');
      const rows=await allData(db,'rsvps');const statements=[];
      let guardSql='(SELECT version FROM events WHERE id=?)=?';const guardArgs=[id,e.version];
      for(const r of body.stages){const s=e.stages.find(s=>s.id===r.stageId);if(s?.capacity&&r.status==='yes'){const guests=Array.isArray(r.guests)?r.guests.map(g=>text(g,40)).filter(Boolean).slice(0,10):[];guardSql+=" AND COALESCE((SELECT SUM(1+COALESCE(json_array_length(data,'$.guests'),0)) FROM rsvps WHERE event_id=? AND stage_id=? AND member_id!=? AND json_extract(data,'$.status')='yes' AND member_id IN (SELECT value FROM json_each(?))),0)+?<=?";guardArgs.push(id,s.id,actor,JSON.stringify(e.invitees),1+guests.length,s.capacity);}}

      for(const r of body.stages){const s=e.stages.find(s=>s.id===r.stageId);if(!s||!Object.keys(RSVP).includes(r.status))fail('环节或参加状态无效');const old=rows.find(x=>x.eventId===id&&x.stageId===s.id&&x.memberId===actor);if(e.deadline&&Date.now()>Date.parse(e.deadline+'+08:00')&&actor!==e.creator&&r.status!==(old?.status||'pending'))fail('报名已截止，请联系组织者调整参加状态');const guests=Array.isArray(r.guests)?r.guests.map(g=>text(g,40)).filter(Boolean).slice(0,10):[];if(r.status==='yes'&&s.capacity){const used=rows.filter(x=>x.eventId===id&&x.stageId===s.id&&x.memberId!==actor&&e.invitees.includes(x.memberId)&&x.status==='yes').reduce((n,x)=>n+1+(x.guests?.length||0),0);if(used+1+guests.length>s.capacity)fail(`「${s.title}」人数已超出容量，请联系组织者`);}const data={...r,eventId:id,stageId:s.id,memberId:actor,guests,needs:text(r.needs,500),updatedAt:stamp()}; statements.push(db.prepare('INSERT INTO rsvps(event_id,stage_id,member_id,data) SELECT ?,?,?,? WHERE '+guardSql+' ON CONFLICT(event_id,stage_id,member_id) DO UPDATE SET data=excluded.data').bind(id,s.id,actor,JSON.stringify(data),...guardArgs));}
      if(body.acknowledge)statements.push(db.prepare('INSERT INTO acknowledgements(event_id,member_id,version) SELECT ?,?,? WHERE '+guardSql+' ON CONFLICT(event_id,member_id) DO UPDATE SET version=excluded.version').bind(id,actor,e.version,...guardArgs));const saved=await db.batch(statements);if(!saved[0]?.meta.changes)fail('安排或人数刚有变化，请刷新后重试',409);return json({ok:true});
    }
    if(action==='ack'&&method==='POST'){if(body.version!==e.version)fail('当前版本已变更，请刷新后确认',409);await db.prepare('INSERT INTO acknowledgements(event_id,member_id,version) VALUES(?,?,?) ON CONFLICT(event_id,member_id) DO UPDATE SET version=excluded.version').bind(id,actor,e.version).run();return json({ok:true});}
    const bookingMatch=action?.match(/^booking\/([^/]+)$/);
    if(bookingMatch&&method==='POST'){
      const stage=e.stages.find(s=>s.id===bookingMatch[1]);if(!stage)fail('环节不存在',404);
      if(actor!==e.creator&&actor!==stage.leader)fail('只有组织者或该环节负责人可以更新预约',403);
      if(body.version!==e.version)fail('安排已有更新，请刷新后重试',409);
      const fields=['bookingStatus','bookingRef','queueStatus','queueNumber','waitMinutes','queueUpdatedAt'];
      const updated={...stage,...Object.fromEntries(fields.map(k=>[k,text(body[k]??stage[k],200)]))};
      if(!['pending','processing','confirmed','failed','cancelled'].includes(updated.bookingStatus)||!['not_taken','waiting','called','seated','abandoned'].includes(updated.queueStatus))fail('预约或排队状态无效');
      const next={...e,version:e.version+1,confirmationVersion:e.confirmationVersion||e.version,stages:e.stages.map(s=>s.id===stage.id?updated:s)};
      const result=await db.prepare('UPDATE events SET data=?,version=? WHERE id=? AND version=?').bind(JSON.stringify(next),next.version,id,e.version).run();if(!result.meta.changes)fail('安排已更新，请刷新后重试',409);
      const change={id:uid(),eventId:id,memberId:actor,version:next.version,text:`更新了「${stage.title}」的预约与排队信息`,createdAt:stamp()};
      await db.prepare('INSERT INTO changes(id,event_id,data,created_at) VALUES(?,?,?,?)').bind(change.id,id,JSON.stringify(change),change.createdAt).run();return json({ok:true});
    }
    if(action==='comments'&&method==='POST'){const content=text(body.text,2000);if(!content)fail('写点想法再发送吧');if(body.parentId){const p=await db.prepare('SELECT event_id FROM comments WHERE id=?').bind(body.parentId).first();if(!p||p.event_id!==id)fail('回复的评论不存在');}const c={id:uid(),eventId:id,memberId:actor,text:content,parentId:body.parentId||null,status:'discussion',createdAt:stamp()};await db.prepare('INSERT INTO comments(id,event_id,data,created_at) VALUES(?,?,?,?)').bind(c.id,id,JSON.stringify(c),c.createdAt).run();return json({ok:true},201);}
    const cm=action?.match(/^comments\/([^/]+)$/);
    if(cm){const row=await db.prepare('SELECT data FROM comments WHERE id=? AND event_id=?').bind(cm[1],id).first();if(!row)fail('评论不存在',404);const c=JSON.parse(row.data);if(method==='DELETE'){if(c.memberId!==actor&&e.creator!==actor)fail('只能删除自己的评论',403);c.deleted=true;c.text='这条评论已删除';}else if(method==='PUT'){if(body.status){if(e.creator!==actor)fail('只有组织者可以处理建议',403);if(!['discussion','accepted','rejected'].includes(body.status))fail('处理状态无效');c.status=body.status;}else {if(c.memberId!==actor)fail('只能编辑自己的评论',403);c.text=text(body.text,2000);if(!c.text)fail('评论不能为空');c.editedAt=stamp();}}else fail('操作不支持',405);await db.prepare('UPDATE comments SET data=? WHERE id=?').bind(JSON.stringify(c),c.id).run();return json({ok:true});}
    if(action==='expenses'&&method==='POST'){if(!text(body.title,80)||!member(body.payer))fail('请填写费用名称和垫付人');const stage=e.stages.find(s=>s.id===body.stageId);if(!stage)fail('请选择费用所属环节');if(!Array.isArray(body.memberIds)||!body.memberIds.length||body.memberIds.some(id=>!member(id)))fail('请选择分摊人员');const ids=[...new Set(body.memberIds)];const rows=await allData(db,'rsvps'), weights={};for(const mid of ids){const r=rows.find(r=>r.eventId===id&&r.stageId===stage.id&&r.memberId===mid);weights[mid]=1+(r?.status==='yes'?r.guests?.length||0:0);}const shares=splitExpense(body.amount,ids,weights);const ex={id:uid(),eventId:id,stageId:stage.id,title:text(body.title,80),amount:body.amount,currency:e.currency,payer:body.payer,createdBy:actor,shares,settled:[],createdAt:stamp()};await db.prepare('INSERT INTO expenses(id,event_id,data,created_at) VALUES(?,?,?,?)').bind(ex.id,id,JSON.stringify(ex),ex.createdAt).run();return json({ok:true},201);}
    const exm=action?.match(/^expenses\/([^/]+)$/);if(exm){const row=await db.prepare('SELECT data FROM expenses WHERE id=? AND event_id=?').bind(exm[1],id).first();if(!row)fail('费用不存在',404);const x=JSON.parse(row.data);if(method==='DELETE'){if(![x.createdBy,e.creator].includes(actor))fail('只有记录人或组织者可以删除费用',403);await db.prepare('DELETE FROM expenses WHERE id=?').bind(x.id).run();return json({ok:true});}if(method==='PUT'){if(!x.shares.some(s=>s.memberId===actor))fail('你不在这笔费用的分摊名单中',403);if(body.settled){await db.prepare("UPDATE expenses SET data=json_insert(data,'$.settled[#]',?) WHERE id=? AND NOT EXISTS (SELECT 1 FROM json_each(expenses.data,'$.settled') WHERE value=?)").bind(actor,x.id,actor).run();}else{await db.prepare("UPDATE expenses SET data=json_set(data,'$.settled',json((SELECT json_group_array(value) FROM json_each(expenses.data,'$.settled') WHERE value!=?))) WHERE id=?").bind(actor,x.id).run();}return json({ok:true});}}
    fail('操作不存在',404);
  } catch(error) { if(!error.status)console.error(error);return json({error:error.status?error.message:'保存遇到问题，请稍后重试'},error.status||500); }
}
export async function api(request,db,{allowedOrigins=[]}={}) {
  const origin=request.headers.get('origin');
  const normalized=allowedOrigins.map(value=>{try{return new URL(value).origin;}catch{return '';}}).filter(Boolean);
  const sameOrigin=!origin||origin===new URL(request.url).origin;
  if(!sameOrigin&&!normalized.includes(origin))return json({error:'请求来源未获授权'},403);
  const cors=origin&&!sameOrigin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Member-Id, Authorization','Access-Control-Max-Age':'600','Vary':'Origin'}:{};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const response=await handleApi(request,db,{allowedOrigins:normalized});
  const headers=new Headers(response.headers);for(const [key,value] of Object.entries(cors))headers.set(key,value);
  return new Response(response.body,{status:response.status,headers});
}
