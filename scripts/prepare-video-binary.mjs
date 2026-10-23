import {createRequire} from 'node:module';
import {cp,mkdir,access} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../',import.meta.url));
export async function prepareVideoBinary(platform,arch){
 const os={win32:'win',darwin:'mac',linux:'linux'}[platform];if(!os)throw Error('Videoexport: unbekanntes Build-Ziel.');
 const directory=join(root,'.build','video',`${os}-${arch}`),source=dirname(require.resolve('ffmpeg-static/package.json'));
 await mkdir(directory,{recursive:true});
 const executable='ffmpeg'+(platform==='win32'?'.exe':'');
 if(platform===process.platform&&arch===process.arch){
  for(const name of [executable,executable+'.LICENSE',executable+'.README','LICENSE']){
   try{await cp(join(source,name),join(directory,name));}catch(error){if(error.code!=='ENOENT'||name===executable)throw error;}
  }
 }else{
  // Run the pinned package's installer in an isolated target directory. A cross
  // build must never package the host binary or replace the development one.
  for(const name of ['index.js','install.js','package.json','LICENSE'])await cp(join(source,name),join(directory,name));
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(directory,'install.js')],{stdio:'inherit',env:{...process.env,npm_config_platform:platform,npm_config_arch:arch,FFMPEG_BIN:''}});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('FFmpeg für das Zielsystem konnte nicht vorbereitet werden.')));});
 }
 await access(join(directory,executable));return directory;
}
