import {readFile,writeFile,mkdir,readdir,cp} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import {build} from 'esbuild';
const root=resolve('dist/client');const files=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,e.name);if(e.isDirectory())await walk(path);else files.push(path);}}
await walk(root);
const mimes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon'};
const entries=await Promise.all(files.map(async file=>[ '/'+relative(root,file).replaceAll('\\','/'),{type:mimes[extname(file)]||'application/octet-stream',body:(await readFile(file)).toString('base64')} ]));
const source=`import { api } from '../server/api.mjs';\nconst assets=${JSON.stringify(Object.fromEntries(entries))};\nexport default { async fetch(request,env,ctx){ const url=new URL(request.url); if(url.pathname.startsWith('/api/')){if(!env.DB)return new Response(JSON.stringify({error:'数据库绑定尚未就绪'}),{status:503,headers:{'Content-Type':'application/json'}});return api(request,env.DB);} if(!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});const a=assets[url.pathname]||(url.pathname.includes('.')?null:assets['/index.html']);if(!a)return new Response('Not found',{status:404});return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(a.body),c=>c.charCodeAt(0)),{headers:{'Content-Type':a.type,'Cache-Control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'public, max-age=60','X-Content-Type-Options':'nosniff'}});}};`;
await mkdir('dist/server',{recursive:true});
await build({stdin:{contents:source,resolveDir:resolve('scripts'),sourcefile:'worker.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'dist/server/index.js'});
await mkdir('dist/.openai',{recursive:true});await cp('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/drizzle',{recursive:true});
console.log('Worker bundle and D1 migrations packaged.');
