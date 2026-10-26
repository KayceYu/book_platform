import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {MEMBERS} from './domain.mjs';
import {apiRequest} from './transport.mjs';

const defaults={MEMBERS,member:id=>MEMBERS.find(m=>m.id===id)};
export const MembersContext=createContext(defaults);
export const useMembers=()=>useContext(MembersContext);
export function useMemberDirectory(profiles,current) {
 const cache=useRef(new Map()),[photos,setPhotos]=useState({});
 useEffect(()=>{
  let active=true;
  if(!current){for(const image of cache.current.values())URL.revokeObjectURL(image.url);cache.current.clear();setPhotos({});return;}
  for(const [id,image] of cache.current){if(!profiles.some(p=>p.memberId===id&&p.avatarVersion===image.version)){URL.revokeObjectURL(image.url);cache.current.delete(id);setPhotos(old=>{const next={...old};delete next[id];return next;});}}
  for(const profile of profiles){
   if(!profile.avatarVersion||cache.current.get(profile.memberId)?.version===profile.avatarVersion)continue;
   (async()=>{try{
    const response=await apiRequest('/api/profiles/'+profile.memberId+'/avatar?v='+encodeURIComponent(profile.avatarVersion));
    if(!response.ok)return;const blob=await response.blob();if(!active)return;
    const image={version:profile.avatarVersion,url:URL.createObjectURL(blob)};
    const previous=cache.current.get(profile.memberId);if(previous)URL.revokeObjectURL(previous.url);
    cache.current.set(profile.memberId,image);setPhotos(old=>({...old,[profile.memberId]:image}));
   }catch{}})();
  }
  return()=>{active=false;};
 },[profiles,current]);
 useEffect(()=>()=>{for(const image of cache.current.values())URL.revokeObjectURL(image.url);},[]);
 const members=MEMBERS.map(base=>{const profile=profiles.find(p=>p.memberId===base.id);return {...base,...profile,id:base.id,originalName:base.name,photo:profile?.avatarVersion&&photos[base.id]?.version===profile.avatarVersion?photos[base.id].url:null};});
 return {MEMBERS:members,member:id=>members.find(m=>m.id===id)};
}

export async function prepareAvatar(file) {
 if(!file)return null;
 if(file.size>12*1024*1024)throw new Error('图片超过 12 MB，请选择较小的照片');
 if(file.type==='image/svg+xml'||/\.svg$/i.test(file.name)||file.type&&!file.type.startsWith('image/'))throw new Error('请选择照片或 JPG、PNG、WebP 图片');
 const url=URL.createObjectURL(file),image=new Image();
 try{
  image.src=url;await image.decode();
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)throw new Error('图片尺寸过大，请换一张较小的照片');
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=384;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('当前浏览器暂不支持处理照片');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,384,384);
  const edge=Math.min(image.naturalWidth,image.naturalHeight);
  ctx.drawImage(image,(image.naturalWidth-edge)/2,(image.naturalHeight-edge)/2,edge,edge,0,0,384,384);
  for(const quality of [.86,.7,.55,.4,.25]){const value=canvas.toDataURL('image/jpeg',quality);if(value.length<=87407)return value;}
  throw new Error('照片内容过于复杂，请换一张图片');
 }catch(error){if(error.name==='EncodingError')throw new Error('这张照片无法读取，请尝试 JPG、PNG 或 WebP 格式');throw error;}
 finally{URL.revokeObjectURL(url);}
}
