export const MEMBERS = [
  { id: 'chang', name: '肠炎宁', color: '#EAF5EE', ink: '#1F7552', avatar: 'leaf' },
  { id: 'cha', name: '查', color: '#FFF1D4', ink: '#895400', avatar: 'sun' },
  { id: 'four', name: '404', color: '#E7F1FC', ink: '#345A8C', avatar: 'cloud' },
  { id: 'xia', name: '夏洛', color: '#FCEAF1', ink: '#AD436A', avatar: 'flower' },
  { id: 'fish', name: '烤鱼', color: '#E8F4F4', ink: '#28696C', avatar: 'fish' },
  { id: 'red', name: '红裙子', color: '#F8EADF', ink: '#A65339', avatar: 'star' },
];
export const member = id => MEMBERS.find(m => m.id === id);
export const TYPES = {
  food: { name: '约饭', icon: 'Utensils', color: '#FFF1DF', ink: '#A66B30', tagline: '好好吃饭，好好见面', title: '一起吃顿好吃的', stage: '一起吃饭', note: '店名、分店和忌口，提前说清楚。' },
  game: { name: '游戏局', icon: 'Gamepad2', color: '#EEF0FB', ink: '#6461A4', tagline: '组好队，快乐加倍', title: '今晚一起快乐开黑', stage: '组队游戏', note: '说好平台、人数和结束时间，快乐不熬夜。' },
  board: { name: '桌游', icon: 'Dices', color: '#FCEAF0', ink: '#B15A7A', tagline: '骰子一掷，快乐开始', title: '一起开一局桌游', stage: '桌游时间', note: '新手也欢迎，规则和教学负责人提前安排。' },
  shopping: { name: '逛街', icon: 'ShoppingBag', color: '#EAF5EE', ink: '#357257', tagline: '慢慢逛，随便聊', title: '逛街不赶路，边走边聊', stage: '逛街散步', note: '集合入口、路线和休息点都可以安排。' },
  outdoor: { name: '户外', icon: 'Trees', color: '#EAF5EE', ink: '#357257', tagline: '出门走走，给心情放个假', title: '周日，出来透透气', stage: '公园轻徒步', note: '记录距离、爬升与退出点，走累了就休息。' },
  custom: { name: '自定义', icon: 'Sparkles', color: '#FFF9E8', ink: '#895400', tagline: '你的想法，也能成局', title: '', stage: '活动环节', note: '把想做的事情，排进同一天。' },
};
export const STATUS = { draft: '草稿', planning: '征询中', confirmed: '已定案', ongoing: '进行中', ended: '已结束', cancelled: '已取消' };
export const RSVP = { pending: '待回应', maybe: '待定', yes: '确认参加', no: '不参加', withdrawn: '已退出' };
export const BOOKING = { pending: '待处理', processing: '处理中', confirmed: '已预约', failed: '未成功', cancelled: '已取消' };
export const ATTENDANCE = { not_started: '未出发', travelling: '途中', delayed: '延误', arrived: '已到场', left: '已离开' };
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function dateText(date, full = false) { if (!date) return '日期待定'; const d = new Date(date + 'T12:00:00+08:00'); return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short', ...(full ? { year: 'numeric' } : {}) }).format(d); }
export function money(cents, currency = 'CNY') { return `${currency === 'HKD' ? 'HK$' : '¥'}${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`; }
export function makeStage(type = 'food', start = '13:00', end = '15:00') { return { id: crypto.randomUUID(), type, title: TYPES[type].stage, start, end, location: '', branch: '', address: '', meetup: '', mapUrl: '', leader: '', budget: 0, capacity: 0, notes: '', bookingMode: 'none', bookingStatus: 'pending', bookingRef: '', queueStatus: 'not_taken', queueNumber: '', waitMinutes: '', queueUpdatedAt: '', transportMinutes: '', distance: '', elevation: '', restPoints: '', exitPoints: '', route: '', gameName: '', platform: '', experience: '', }; }
export function makeEvent(type, creator) { const date = today(); return { title: TYPES[type].title, type, description: '', date, endDate: date, start: '13:00', end: '16:00', deadline: '', currency: 'CNY', status: 'planning', creator, invitees: MEMBERS.map(m => m.id), stages: [makeStage(type)], version: 1, isDemo: false }; }
export function stageCounts(event, stageId, rsvps) { const rows = rsvps.filter(r => r.eventId === event.id && r.stageId === stageId && event.invitees.includes(r.memberId)); const yes = rows.filter(r => r.status === 'yes'); return { yes: yes.length, guests: yes.reduce((n,r) => n + (r.guests?.length || 0), 0), maybe: rows.filter(r => r.status === 'maybe').length, pending: event.invitees.filter(id => !rows.some(r => r.memberId === id && r.status !== 'pending')).length, people: yes.map(r => r.memberId) }; }
export function eventCounts(event, rsvps) { const rows = rsvps.filter(r => r.eventId === event.id && event.invitees.includes(r.memberId)); const yes = event.invitees.filter(id => rows.some(r => r.memberId === id && r.status === 'yes')); const maybe = event.invitees.filter(id => !yes.includes(id) && rows.some(r => r.memberId === id && r.status === 'maybe')); return { yes: yes.length, maybe: maybe.length, pending: event.invitees.filter(id => !rows.some(r => r.memberId === id && r.status !== 'pending')).length, people: yes }; }
export function splitExpense(amount, ids, weights = {}) { if (!Number.isSafeInteger(amount) || amount <= 0 || !ids.length) throw new Error('请输入有效金额并选择分摊人员'); const total = ids.reduce((n,id) => n + (weights[id] || 1), 0); let used = 0; return ids.map((id,i) => { const share = i === ids.length - 1 ? amount - used : Math.floor(amount * (weights[id] || 1) / total); used += share; return { memberId: id, amount: share }; }); }
export function needsAck(event, actor, rsvps, acks) { return ['confirmed','ongoing'].includes(event.status) && rsvps.some(r => r.eventId === event.id && r.memberId === actor && r.status === 'yes') && !acks.some(a => a.eventId === event.id && a.memberId === actor && a.version >= (event.confirmationVersion || event.version)); }
export function appendStage(event,type) { const last=event.stages.at(-1);const cursor=new Date(`${last.endDate||last.date||event.date}T${last.end}:00Z`);cursor.setUTCMinutes(cursor.getUTCMinutes()+30);const begin=cursor.toISOString();cursor.setUTCMinutes(cursor.getUTCMinutes()+90);const finish=cursor.toISOString();const stage={...makeStage(type,begin.slice(11,16),finish.slice(11,16)),leader:event.creator,date:begin.slice(0,10)===event.date?'':begin.slice(0,10),endDate:finish.slice(0,10)===begin.slice(0,10)?'':finish.slice(0,10)};const extendsEnd=finish.slice(0,16)>(event.endDate+'T'+event.end);return {...event,stages:[...event.stages,stage],...(extendsEnd?{endDate:finish.slice(0,10),end:finish.slice(11,16)}:{})}; }
export function eventTime(event) { return event.date === event.endDate ? `${event.start}–${event.end}` : `${event.start}–${event.endDate.slice(5).replace('-','/')} ${event.end}`; }
