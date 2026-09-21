import {request} from 'node:http';

// A short, fresh HTTP/1.1 exchange for the lamp's provisioning server. Keep
// canonical header spelling and send headers + body together with req.end().
// No connection pooling, chunked uploads, redirects or automatic POST retries.
export function setupHTTP(url, {method='GET', headers={}, body, signal}={}) {
  return new Promise((resolve,reject)=>{
    const req=request(url,{method,agent:false,signal,headers:{...headers,
      Connection:'close',...(body===undefined?{}:{'Content-Length':Buffer.byteLength(body)})}},res=>{
      const chunks=[];let length=0;
      res.on('error',reject);
      res.on('data',chunk=>{
        length+=chunk.length;
        if(length>32768){res.destroy(Error('Setup response too large'));return;}
        chunks.push(chunk);
      });
      res.on('end',()=>{
        const bytes=Buffer.concat(chunks);
        resolve({ok:res.statusCode>=200&&res.statusCode<300,status:res.statusCode,
          json:async()=>JSON.parse(bytes.toString('utf8')),
          arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
      });
    });
    req.on('error',reject);
    req.end(body);
  });
}
