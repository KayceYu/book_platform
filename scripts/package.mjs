import {mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await mkdir('outputs',{recursive:true});
execFileSync('tar',['-czf','outputs/cougeju-site.tar.gz','.openai','dist/server','drizzle'],{stdio:'inherit'});
console.log('Deployment archive: outputs/cougeju-site.tar.gz');
