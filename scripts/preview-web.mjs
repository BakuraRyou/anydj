import http from 'node:http';
import {readFile,access} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/web/',import.meta.url));
await access(resolve(root,'index.html')).catch(()=>{throw Error('Zuerst npm run build:web ausführen.');});
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
    const url=new URL(req.url,'http://localhost');
    const file=resolve(root,decodeURIComponent(url.pathname.slice(1)||'index.html'));
    if(!file.startsWith(resolve(root)+sep))throw Error('Invalid path');
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end('Nicht gefunden');}
});
server.listen(Number(process.env.WEB_PORT||4173),'127.0.0.1',()=>console.log(`AnyDj Web-Vorschau: http://127.0.0.1:${server.address().port}`));
