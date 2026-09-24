import http from 'node:http';
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const target=new URL(process.env.VR_SIM_SOURCE||`http://127.0.0.1:${process.env.VR_PREVIEW_PORT||3031}`);
if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw Error('VR_SIM_SOURCE muss eine HTTP(S)-Adresse ohne Zugangsdaten sein.');
const port=Number(process.env.VR_SIM_PORT||3032);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('VR_SIM_PORT muss zwischen 1 und 65535 liegen.');
const assets=new Map([
  ['iwer.js','node_modules/iwer/build/iwer.module.js'],
  ['devui.js','node_modules/@iwer/devui/build/iwer-devui.module.js'],
  ['vr-sim.js','scripts/vr-sim.js'],
  ...['vr-view.js','vr-view.css','dmx-stage-vr.js','dmx-vr-console.js','dmx-vr-playback.js','dmx-ar-model.js','dmx-ar-planner.js','dmx-ar-controls.js','dmx-ar.css','dmx-stage-3d-renderer.js'].map(name=>[name,'public/'+name]),
]);
// Fail before opening a browser if the optional simulator packages are missing.
await Promise.all(['iwer.js','devui.js'].map(name=>readFile(resolve(root,assets.get(name)))));
const api=new Map([['/api/vr-preview/test-connect','GET'],['/api/vr-preview/stream','GET'],['/api/vr-preview/command','POST']]);
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://127.0.0.1:${port}`);
    if(req.headers.host!==`127.0.0.1:${port}`||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==url.origin)){
      res.writeHead(403);res.end('Fremder Zugriff gesperrt.');return;
    }
    res.setHeader('Cache-Control','no-store');
    if(api.get(url.pathname)===req.method){
      const upstream=(target.protocol==='https:'?https:http).request(new URL(url.pathname+url.search,target),{method:req.method,headers:{...(req.headers['content-type']?{'Content-Type':req.headers['content-type']}:{}),...(req.method==='POST'?{'X-AnyDj-Local':'1'}:{})}},response=>{
        res.writeHead(response.statusCode,{'Content-Type':response.headers['content-type']||'application/json'});response.pipe(res);
      });
      upstream.on('error',()=>{if(!res.headersSent){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'Keine Live-Vorschau erreichbar. Im laufenden AnyDj-Deck: 3D → VR-Vorschau verbinden → Übertragung starten.'}}));}else res.end();});
      upstream.setTimeout(15000,()=>upstream.destroy());
      res.on('close',()=>upstream.destroy());req.pipe(upstream);return;
    }
    if(req.method==='GET'&&url.pathname==='/vr-test'){
      const html=(await readFile(resolve(root,'public/vr-view.html'),'utf8')).replace('src="/vr-view.js"','src="/vr-sim.js"').replace('AnyDj · Live-Vorschau','AnyDj · VR-Simulation');
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return;
    }
    const file=assets.get(url.pathname.slice(1));
    if(req.method==='GET'&&file){
      let body=await readFile(resolve(root,file),'utf8');
      if(file.endsWith('iwer-devui.module.js'))body=body.replace("from 'iwer'","from '/iwer.js'");
      res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});res.end(body);return;
    }
    res.writeHead(404);res.end('Nicht gefunden.');
  }catch(error){console.error(error.message);if(!res.headersSent)res.writeHead(500);res.end('Simulator konnte die Datei nicht laden.');}
});
server.on('error',error=>{console.error(`Simulator: ${error.message}`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${port}/vr-test`;
  console.log(`VR-Simulation: ${url}\nLive-Quelle: ${target.origin}\nIm laufenden Deck: 3D → VR-Vorschau verbinden → Übertragung starten.\nVR startet automatisch, sobald Live-Daten eintreffen. Beenden: Strg+C.`);
  if(process.argv.includes('--no-open'))return;
  const command=process.env.VR_SIM_BROWSER||(process.platform==='win32'?'cmd':process.platform==='darwin'?'open':'google-chrome');
  const args=process.env.VR_SIM_BROWSER?[url]:process.platform==='win32'?['/c','start','','msedge',url]:process.platform==='darwin'?['-a','Google Chrome',url]:[url];
  const browser=spawn(command,args,{stdio:'ignore',detached:true});
  browser.on('error',error=>console.error(`Browser konnte nicht geöffnet werden: ${error.message}\nBitte ${url} in Chrome oder Edge öffnen. Alternativ VR_SIM_BROWSER setzen.`));browser.unref();
});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.closeAllConnections();server.close();});
