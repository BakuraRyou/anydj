import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {execFileSync,spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {createApp} from '../server.mjs';

for(const lan of [false,true])test(`HTTPS ${lan?'LAN':'localhost'} serves TLS and accepts custom certificates`,async t=>{
  const dir=await mkdtemp(join(tmpdir(),'anydj-tls-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const certFile=join(dir,'cert.pem'),keyFile=join(dir,'key.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost',
    '-addext','subjectAltName=IP:127.0.0.1,DNS:localhost','-keyout',keyFile,'-out',certFile],{stdio:'ignore'});
  const cert=await readFile(certFile),key=await readFile(keyFile);
  const app=await createApp({demo:true,dataDir:join(dir,'data'),tls:{cert,key}});
  t.after(()=>new Promise(resolve=>{app.server.closeAllConnections();app.server.close(resolve);}));
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const port=app.server.address().port,origin=`https://127.0.0.1:${port}`;
  const request=(path,headers={})=>new Promise((resolve,reject)=>{
    https.get(origin+path,{ca:cert,headers},res=>{
      let body='';res.on('data',data=>body+=data);res.on('end',()=>resolve({status:res.statusCode,body}));
    }).on('error',reject);
  });
  assert.equal((await request('/dj')).status,200);
  assert.equal((await request('/api/meta',{Origin:origin})).status,200);
  assert.equal((await request('/api/meta',{Origin:`http://127.0.0.1:${port}`})).status,403);
  assert.equal((await request('/api/meta',{Origin:'https://evil.test','X-Forwarded-Proto':'https'})).status,403);
  assert.equal((await request('/spotify-callback.html?code=test',{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'})).status,200);
  assert.equal((await request('/.certs/localhost-key.pem')).status,404);
  await new Promise(resolve=>app.server.close(resolve));

  const child=spawn(process.execPath,['scripts/dev-https.mjs','--demo',...(lan?['--lan']:[])],{env:{...process.env,PORT:String(port),SSL_CERT_FILE:certFile,SSL_KEY_FILE:keyFile,WIZ_DATA_DIR:join(dir,'cli-data')},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('HTTPS dev command did not start')),10000);
    let output='';child.stdout.on('data',data=>{output+=data;if(output.includes('Spotify Redirect URI:')){clearTimeout(timer);resolve();}});
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);reject(Error('Dev command exited: '+code));});
  });
  assert.equal((await request('/api/meta',{Origin:origin})).status,200);
});
