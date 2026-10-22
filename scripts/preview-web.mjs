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
    // Audio metadata and seeking require a known length and byte-range responses.
    let start=0,end=data.length-1,status=200;
    if(req.headers.range&&req.method==='GET'){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${data.length}`});res.end();return;}
      start=match[1]?Number(match[1]):Math.max(0,data.length-Number(match[2]));
      end=match[1]?(match[2]?Math.min(data.length-1,Number(match[2])):data.length-1):data.length-1;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=data.length){res.writeHead(416,{'Content-Range':`bytes */${data.length}`});res.end();return;}
      status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${data.length}`);
    }
    res.setHeader('Accept-Ranges','bytes');
    res.writeHead(status,{'Content-Type':{'.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.m4a':'audio/mp4','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp'}[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Length':end-start+1});res.end(req.method==='HEAD'?undefined:data.subarray(start,end+1));
  }catch{res.writeHead(404);res.end('Nicht gefunden');}
});
server.listen(Number(process.env.WEB_PORT||4173),'127.0.0.1',()=>console.log(`AnyDj Web-Vorschau: http://127.0.0.1:${server.address().port}`));
