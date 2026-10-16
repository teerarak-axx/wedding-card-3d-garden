import { build } from 'vite';
import { readdirSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
await build({build:{copyPublicDir:false,rollupOptions:{output:{manualChunks:{three:['three']}}}}});
function copy(source,destination){mkdirSync(destination,{recursive:true});for(const item of readdirSync(source,{withFileTypes:true})){const from=join(source,item.name),to=join(destination,item.name);if(item.isDirectory())copy(from,to);else writeFileSync(to,readFileSync(from));}}
copy('public','dist');
console.log('Static assets copied. Production build ready.');
