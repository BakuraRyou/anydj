import {networkInterfaces} from 'node:os';
import {X509Certificate} from 'node:crypto';
import {spawn} from 'node:child_process';
import {access, chmod, mkdir, readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
const run=(command,params)=>new Promise((resolve,reject)=>{
  const child=spawn(command,params,{cwd:root,stdio:'inherit'});
  child.once('error',error=>reject(error.code==='ENOENT'
    ? Error('mkcert fehlt. Unter Debian/Ubuntu: sudo apt install mkcert libnss3-tools. Danach den Befehl erneut ausführen. Andere Systeme: https://github.com/FiloSottile/mkcert#installation')
    : error));
  child.once('exit',code=>code===0?resolve():reject(Error(`${command} fehlgeschlagen (Exit ${code}).`)));
});
const exists=path=>access(path).then(()=>true,()=>false);
async function main(){
  if(args.some(arg=>!['--cert-only','--demo','--lan'].includes(arg)))throw Error('Erlaubte Optionen: --cert-only, --demo, --lan.');
  const lan=args.includes('--lan'),name=lan?'lan':'localhost';
  const addresses=lan?[...new Set(Object.values(networkInterfaces()).flat().filter(v=>v&&!v.internal&&v.family==='IPv4').map(v=>v.address))]:[];
  const names=['127.0.0.1','localhost','::1',...addresses];
  const custom=Boolean(process.env.SSL_CERT_FILE||process.env.SSL_KEY_FILE);
  if(custom&&(!process.env.SSL_CERT_FILE||!process.env.SSL_KEY_FILE))throw Error('SSL_CERT_FILE und SSL_KEY_FILE bitte gemeinsam setzen.');
  const cert=resolve(process.env.SSL_CERT_FILE||join(root,`.certs/${name}.pem`));
  const key=resolve(process.env.SSL_KEY_FILE||join(root,`.certs/${name}-key.pem`));
  const present=(await Promise.all([exists(cert),exists(key)])).every(Boolean);
  if(custom&&!present)throw Error('SSL_CERT_FILE oder SSL_KEY_FILE ist nicht lesbar.');
  let renew=!present;
  if(!custom&&present){try{const existing=new X509Certificate(await readFile(cert));renew=Date.parse(existing.validTo)<Date.now()+86400000||names.some(value=>value==='localhost'?!existing.checkHost(value):!existing.checkIP(value));}catch{renew=true;}}
  if(!custom&&(renew||args.includes('--cert-only'))){
    console.log('Lokale Zertifizierungsstelle mit mkcert einrichten (ggf. System-Passwort erforderlich) …');
    await run('mkcert',['-install']);
    await mkdir(join(root,'.certs'),{recursive:true,mode:0o700});
    await run('mkcert',['-cert-file',cert,'-key-file',key,...names]);
    await chmod(key,0o600);
  }
  if(args.includes('--cert-only')){console.log(`Lokales Zertifikat bereit. Start: npm run ${lan?'lan':'dev:https'}`);return;}
  if(lan)console.log('HTTPS im Heimnetz: Das Zertifikat muss auch vom Headset/Handy als vertrauenswürdig akzeptiert werden. Lokales mkcert-Vertrauen auf dem PC wird nicht automatisch übertragen.');
  const child=spawn(process.execPath,['--watch',join(root,'server.mjs'),'--https',...(lan?['--lan']:[]),...(args.includes('--demo')?['--demo']:[])],{
    cwd:root,stdio:'inherit',env:{...process.env,HOST:lan?'0.0.0.0':'127.0.0.1',SSL_CERT_FILE:cert,SSL_KEY_FILE:key},
  });
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
  child.once('error',error=>{console.error(error.message);process.exitCode=1;});
  child.once('exit',(code,signal)=>{process.exitCode=code??(signal==='SIGINT'||signal==='SIGTERM'?0:1);});
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
