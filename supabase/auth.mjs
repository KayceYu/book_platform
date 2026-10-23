const enc=new TextEncoder();
const encode=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),x=>x.charCodeAt(0));
const key=secret=>crypto.subtle.importKey('raw',enc.encode('cougeju-session-v2:'+secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
export async function hashCode(code){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(code)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function issueSession(memberId,secret,now=Date.now()){
 const header=encode(enc.encode(JSON.stringify({alg:'HS256',typ:'JWT'})));const payload=encode(enc.encode(JSON.stringify({sub:memberId,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+7*86400,aud:'cougeju'})));const message=header+'.'+payload;return message+'.'+encode(await crypto.subtle.sign('HMAC',await key(secret),enc.encode(message)));
}
export async function verifySession(token,secret,now=Date.now()){
 try{const parts=token.split('.');if(parts.length!==3)return null;const valid=await crypto.subtle.verify('HMAC',await key(secret),decode(parts[2]),enc.encode(parts[0]+'.'+parts[1]));if(!valid)return null;const payload=JSON.parse(new TextDecoder().decode(decode(parts[1])));return payload.aud==='cougeju'&&payload.exp>now/1000?payload.sub:null;}catch{return null;}
}
