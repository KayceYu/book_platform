import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5173';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];await mkdir('test-results',{recursive:true});
const a=await browser.newContext({viewport:{width:390,height:844}}),b=await browser.newContext({viewport:{width:390,height:844}});
const owner=await a.newPage(),guest=await b.newPage();
for(const page of [owner,guest])page.on('pageerror',e=>errors.push(e.message));
async function choose(page,name){await page.locator('.identity-btn').click();await page.getByRole('dialog').getByRole('button',{name,exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});}
async function overflow(page,width){await page.setViewportSize({width,height:900});await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`horizontal overflow at ${width}px on ${page.url()}`);}
let id;
try{
  await owner.goto(origin,{waitUntil:'networkidle'});await choose(owner,'烤鱼');
  await owner.locator('.template-food').click();const form=owner.getByRole('dialog');
  await form.getByLabel('活动名称 *',{exact:true}).fill('浏览器验收 · 午餐与开黑');
  await form.getByLabel('开始日期 *',{exact:true}).fill('2026-12-12');
  await form.getByLabel('结束日期 *',{exact:true}).fill('2026-12-12');
  await form.getByLabel('选择追加环节模板').selectOption('game');
  assert.equal(await form.locator('.stage-editor').count(),2);
  await form.getByRole('button',{name:'创建活动',exact:true}).click();
  await owner.waitForURL(/#event\//);id=new URL(owner.url()).hash.slice('#event/'.length);
  await owner.getByRole('heading',{name:'浏览器验收 · 午餐与开黑',exact:true}).waitFor();
  console.log('PASS template creation, fixed roster and two-phase itinerary');
  await guest.goto(origin+'/#event/'+id,{waitUntil:'networkidle'});await choose(guest,'夏洛');
  await guest.locator('.mobile-join-bar').getByRole('button').click();const registration=guest.getByRole('dialog');
  const stage1=registration.locator('.rsvp-stage').nth(0),stage2=registration.locator('.rsvp-stage').nth(1);
  await stage1.getByRole('button',{name:'参加',exact:true}).click();await stage2.getByRole('button',{name:'不参加',exact:true}).click();
  await stage1.getByLabel('最晚离开（选填）').fill('14:00');
  await stage1.getByText('同行者、交通与个人需求',{exact:true}).click();
  await stage1.getByLabel('同行者昵称（逗号分隔）').fill('同行朋友');
  await stage1.getByLabel('忌口、饮酒、住宿与返程需求').fill('只吃微辣');
  await registration.getByRole('button',{name:'保存我的报名'}).click();await registration.waitFor({state:'hidden'});
  await guest.getByRole('tab',{name:'人员',exact:true}).click();
  assert.match(await guest.locator('.member-stage').nth(0).innerText(),/1 人确认 \+ 1 位同行者/);
  assert.match(await guest.locator('.member-stage').nth(1).innerText(),/0 人确认/);
  console.log('PASS partial participation, companion count, early departure');
  await guest.getByRole('tab',{name:/讨论/}).click();await guest.getByLabel('你的想法').fill('我只来吃饭，可以提前半小时开始吗？');
  await guest.getByRole('button',{name:'发送想法'}).click();await guest.getByText('我只来吃饭，可以提前半小时开始吗？',{exact:true}).waitFor();
  await owner.reload({waitUntil:'networkidle'});await owner.getByRole('tab',{name:/讨论/}).click();
  await owner.getByLabel('建议处理状态').selectOption('accepted');await owner.getByText('已采纳 · 正式安排请看行程',{exact:true}).waitFor();
  await owner.getByRole('button',{name:'回复',exact:true}).click();await owner.getByLabel('你的想法').fill('收到，我来调整正式安排。');await owner.getByRole('button',{name:'发送想法'}).click();await owner.getByText('收到，我来调整正式安排。',{exact:true}).waitFor();
  console.log('PASS shared comments, replies and organizer suggestion handling');
  await owner.getByRole('button',{name:'编辑安排',exact:true}).click();await owner.getByRole('dialog').getByLabel('活动当前状态').selectOption('confirmed');await owner.getByRole('dialog').getByRole('button',{name:'保存并更新安排'}).click();await owner.getByRole('dialog').waitFor({state:'hidden'});
  await guest.reload({waitUntil:'networkidle'});await guest.getByRole('button',{name:'我已确认',exact:true}).click();await guest.getByRole('button',{name:'我已确认',exact:true}).waitFor({state:'hidden'});
  console.log('PASS cross-device plan updates and version acknowledgement');
  await owner.getByRole('tab',{name:'费用',exact:true}).click();await owner.getByRole('button',{name:'记一笔',exact:true}).click();const expense=owner.getByRole('dialog');
  await expense.getByLabel('费用名称 *').fill('测试午餐');await expense.getByLabel('总金额（CNY）*').fill('55.01');await expense.getByRole('button',{name:'保存费用'}).click();await expense.waitFor({state:'hidden'});await owner.getByText('测试午餐',{exact:true}).waitFor();
  console.log('PASS weighted expense split');
  for(const width of [360,768,1440]){await overflow(owner,width);await owner.getByRole('tab',{name:'行程',exact:true}).click();await owner.evaluate(()=>window.scrollTo(0,0));await owner.waitForTimeout(250);await owner.screenshot({path:`test-results/detail-${width}.png`,fullPage:true});}
  for(const target of ['home','schedule','team','profile']){await owner.goto(origin+'/#'+target,{waitUntil:'networkidle'});for(const width of [360,768,1440])await overflow(owner,width);await owner.evaluate(()=>window.scrollTo(0,0));await owner.waitForTimeout(250);await owner.screenshot({path:`test-results/${target}.png`,fullPage:true});}
  console.log('PASS all main pages at 360, 768 and 1440 pixels');
  assert.deepEqual(errors,[]);
  console.log('PASS no browser runtime errors');
}catch(error){await owner.evaluate(()=>window.scrollTo(0,0));await owner.waitForTimeout(250);await owner.screenshot({path:"test-results/failure.png",fullPage:true});console.error(await owner.locator("body").innerText());throw error;}finally{
  if(id)await owner.request.delete(origin+'/api/events/'+id,{data:{}});
  await browser.close();
}
