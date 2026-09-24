import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {AppError} from './wiz.mjs';
// Dedicated preview credentials; never accepted as application/owner tokens.
export function createVRAuth(dataDir){
  let loading;
  const secret=()=>loading??=(async()=>{
    const path=join(dataDir,'vr-pairing.key');await mkdir(dataDir,{recursive:true,mode:0o700});
    try{return await readFile(path);}catch(e){if(e.code!=='ENOENT')throw e;}
    const key=randomBytes(32);try{await writeFile(path,key,{flag:'wx',mode:0o600});return key;}catch(e){if(e.code!=='EEXIST')throw e;return readFile(path);}
  })().catch(e=>{loading=null;throw e;});
  const sign=async payload=>createHmac('sha256',await secret()).update(payload).digest('base64url');
  return {
    async issue(){const payload=Buffer.from(JSON.stringify({id:randomBytes(18).toString('base64url'),expires:Date.now()+180*86400000})).toString('base64url');return payload+'.'+await sign(payload);},
    async verify(token){const fail=()=>{throw new AppError('Gespeicherte Kopplung ist abgelaufen oder ungültig. Bitte einmal neu koppeln.',401);};
      if(typeof token!=='string'||token.length>512)fail();const parts=token.split('.');if(parts.length!==2)fail();
      const expected=Buffer.from(await sign(parts[0])),actual=Buffer.from(parts[1]);if(actual.length!==expected.length||!timingSafeEqual(actual,expected))fail();
      let data;try{data=JSON.parse(Buffer.from(parts[0],'base64url').toString());}catch{fail();}if(!Number.isFinite(data?.expires)||data.expires<=Date.now())fail();
    },
  };
}
