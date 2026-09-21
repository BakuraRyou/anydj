import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep,extname,join} from 'node:path';
import {randomUUID} from 'node:crypto';

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json; charset=utf-8'};
const CSP="default-src 'self'; script-src 'self' https://sdk.scdn.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://resources.tidal.com https://images.tidal.com https://*.scdn.co https://*.spotifycdn.com; media-src 'self' blob: https://*.scdn.co https://*.spotifycdn.com; connect-src 'self' https://openapi.tidal.com https://auth.tidal.com https://accounts.spotify.com https://api.spotify.com https://*.spotify.com wss://*.spotify.com https://*.scdn.co https://*.spotifycdn.com; frame-src https://sdk.scdn.co https://*.spotify.com; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";

export async function watchCrashRestart(appRoot,{interval=1000}={}){
  const file=join(appRoot,'tmp','anydj-crash-restart');
  const read=()=>readFile(file,'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  let previous=await read(),reading=false;
  const timer=setInterval(()=>{
    if(reading)return;reading=true;
    void read().then(value=>{
      if(value===null||value===previous)return;
      previous=value;
      // Intentionally uncaught, outside the promise chain: Passenger replaces us.
      setImmediate(()=>{throw Error('ANYDJ_REQUESTED_RESTART: intentional deployment restart');});
    }).catch(()=>console.error('AnyDj restart marker could not be read.')).finally(()=>{reading=false;});
  },interval);timer.unref();
  return ()=>clearInterval(timer);
}

export async function createHostedServer({root,release='development',appRoot=root,watchRestart=true}){
  const publicRoot=await realpath(join(root,'public'));
  const instance=randomUUID();
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',CSP);
    res.setHeader('Cache-Control','no-cache');
    try{
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
      const pathname=decodeURIComponent(new URL(req.url,'http://anydj.invalid').pathname);
      if(pathname==='/healthz'){
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(req.method==='HEAD'?undefined:JSON.stringify({app:'anydj',status:'ok',release,instance}));return;
      }
      if(pathname.split('/').some(part=>part.startsWith('.'))||pathname.includes('\\')||pathname.includes('\0'))throw Error('Not found');
      const relative=pathname==='/'?'index.html':pathname==='/dj'?'dj.html':pathname.slice(1);
      const file=await realpath(resolve(publicRoot,relative));
      if(!file.startsWith(publicRoot+sep)||!(await stat(file)).isFile()||!MIME[extname(file)])throw Error('Not found');
      const data=await readFile(file);
      res.writeHead(200,{'Content-Type':MIME[extname(file)],'Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);
    }catch{if(!res.headersSent)res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?undefined:'Nicht gefunden');}
  });
  if(watchRestart){const stop=await watchCrashRestart(appRoot);server.once('close',stop);}
  return server;
}

export async function startHostedServer({root,appRoot,release}){
  const server=await createHostedServer({root,appRoot,release});
  // Passenger intercepts listen(); PORT can also be a Unix socket path.
  const value=process.env.PORT||'3000',port=/^\d+$/.test(value)?Number(value):value;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,resolve);});
  const shutdown=()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();};
  process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
  console.log(`AnyDj hosting started · release ${release}`);
  return server;
}
