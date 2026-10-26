import {member} from '../src/domain.mjs';

const invalid=message=>{throw Object.assign(new Error(message),{status:400});};
export function avatarBytes(value) {
 if(typeof value!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)||value.length>87407)invalid('请上传压缩后的 JPG 头像');
 let bytes;try{bytes=Uint8Array.from(atob(value.slice(23)),c=>c.charCodeAt(0));}catch{invalid('头像图片无法读取');}
 if(bytes.length>65536||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)invalid('头像图片无效或超过 64 KB');
 let offset=2,dimensions=false,scan=false;
 while(offset<bytes.length-2){
  if(bytes[offset++]!==255)break;
  while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];if(marker===217)break;
  const length=(bytes[offset]<<8)|bytes[offset+1];if(length<2||offset+length>bytes.length)break;
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
   const height=(bytes[offset+3]<<8)|bytes[offset+4],width=(bytes[offset+5]<<8)|bytes[offset+6];
   if(length<8||!width||!height||width>512||height>512)invalid('头像尺寸需在 512 × 512 以内');
   dimensions=true;
  }
  if(marker===218){scan=true;break;}offset+=length;
 }
 if(!dimensions||!scan)invalid('头像图片无法读取');
 return bytes;
}
export async function listProfiles(db) {
 return (await db.prepare("SELECT value FROM app_meta WHERE key LIKE 'profile:%'").all()).results.map(row=>JSON.parse(row.value)).filter(profile=>member(profile.memberId));
}
export function profileFields(body) {
 if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>24||/[\u0000-\u001f\u007f]/.test(body.name))invalid('昵称需为 1–24 个字符');
 if(typeof body.bio!=='string'||body.bio.length>300||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.bio))invalid('个人说明请控制在 300 个字符以内');
 if(body.avatar!==undefined&&body.avatar!==null)avatarBytes(body.avatar);
 return {name:body.name.trim().normalize('NFC'),bio:body.bio.trim()};
}
