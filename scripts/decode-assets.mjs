import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const assets=[
  {name:'weekend.webp',sha256:'64709618dd7f7e42a32284f10bea52535ecde60f513cc911c621343738af5ffc'},
  {name:'scenes.webp',sha256:'77b9ea90d7d8f3c6c90a6fbde6886df5e3390826513e653f68f1841bb3d4f581'},
];
await mkdir('public/images',{recursive:true});
for(const asset of assets){
  const encoded=await readFile(`assets/encoded/${asset.name}.b64`,'utf8');
  const data=Buffer.from(encoded.trim(),'base64');
  if(createHash('sha256').update(data).digest('hex')!==asset.sha256)throw new Error(`插画资源校验失败：${asset.name}`);
  await writeFile(`public/images/${asset.name}`,data);
}
console.log('Illustration assets restored and verified.');
