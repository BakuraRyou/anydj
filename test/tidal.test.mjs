import test from 'node:test';
import assert from 'node:assert/strict';
import {authorization,validateCallback,callbackURL,createTidalClient,apiURL,resources,normalizeResource,durationSeconds,artworkURL,playlistID,TIDAL_TOKEN_URL} from '../public/tidal-client.js';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const token={clientId:'testClient123',access_token:'access',refresh_token:'refresh',expiresAt:Date.now()+3600000};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers});
test('TIDAL PKCE binds state, callback, expiry and read-only scopes',async()=>{
 const redirect=callbackURL('https://127.0.0.1:3030/dj'),{url,pending}=await authorization(token.clientId,redirect,'channel');const p=new URL(url).searchParams;
 assert.equal(new URL(url).origin,'https://login.tidal.com');assert.equal(p.get('code_challenge_method'),'S256');assert.equal(p.get('code_challenge').length,43);assert.equal(p.get('scope'),'user.read collection.read playlists.read');assert.equal(p.has('client_secret'),false);
 const callback=redirect+'?code=test&state='+pending.state;
 assert.equal(validateCallback(callback,pending).code_verifier,pending.verifier);
 for(const modified of [{...pending,state:'wrong'},{...pending,created:0},null])assert.throws(()=>validateCallback(callback,modified));
 assert.throws(()=>validateCallback(callback.replace('127.0.0.1','other.test'),pending));
 assert.throws(()=>validateCallback(redirect+'?error=access_denied&state='+pending.state,pending),/abgebrochen/);
 assert.equal(callbackURL('https://anydj.de/preview/dj.html'),'https://anydj.de/preview/tidal-callback.html');
 assert.throws(()=>callbackURL('http://192.168.1.2:3030/dj'));
});
test('TIDAL never sends credentials to foreign pagination hosts',async()=>{
 let called=0;const client=createTidalClient({storage:storage(),fetcher:async()=>{called++;return json({});}});client.install(token);
 for(const path of ['https://evil.test/v2/tracks','https://openapi.tidal.com.evil.test/v2/tracks','https://user:secret@openapi.tidal.com/v2/tracks','https://openapi.tidal.com/v1/tracks'])await assert.rejects(client.get(path));assert.equal(called,0);
 assert.equal(apiURL('?page%5Bcursor%5D=next','https://openapi.tidal.com/v2/tracks?x=1'),'https://openapi.tidal.com/v2/tracks?page%5Bcursor%5D=next');
});
test('concurrent TIDAL reads refresh once; disconnect cancels late token install',async()=>{
 let resolve,refreshes=0;const store=storage();const c=createTidalClient({storage:store,fetcher:async(url,options)=>{
  if(url===TIDAL_TOKEN_URL){refreshes++;return new Promise(r=>resolve=r);}assert.equal(options.headers.Authorization,'Bearer new');return json({data:[]});
 }});c.install({...token,expiresAt:0});const pending=[c.get('tracks'),c.get('playlists')];resolve(json({access_token:'new',refresh_token:'rotated',expires_in:3600}));await Promise.all(pending);assert.equal(refreshes,1);
 assert.equal(JSON.parse(store.getItem('anydj-tidal-session')).refresh_token,'rotated');
 c.install({...token,expiresAt:0});const aborted=c.get('tracks');c.disconnect();resolve(json({access_token:'late',expires_in:3600}));await assert.rejects(aborted,/geändert/);assert.equal(c.connected,false);
});
test('TIDAL respects rate limits and retries 401 only once',async()=>{
 let calls=0;const c=createTidalClient({storage:storage(),fetcher:async()=>{calls++;return json({},429,{'Retry-After':'90'});}});c.install(token);
 await assert.rejects(c.get('tracks'),/90 Sekunden/);await assert.rejects(c.get('tracks'),/90 Sekunden/);assert.equal(calls,1);
 let gets=0;const denied=createTidalClient({storage:storage(),fetcher:async url=>url===TIDAL_TOKEN_URL?json({access_token:'next',expires_in:3600}):(gets++,json({},401))});denied.install(token);await assert.rejects(denied.get('users/me'),/abgelaufen/);assert.equal(gets,2);assert.equal(denied.connected,false);
});
test('TIDAL JSON:API resolves covers, artists and ISO durations, preserving duplicate playlist entries',()=>{
 const track={id:'123',type:'tracks',attributes:{title:'Track',duration:'PT3M12.5S'},relationships:{artists:{data:[{id:'a',type:'artists'}]},albums:{data:[{id:'b',type:'albums'}]}}};
 const included=[track,{id:'a',type:'artists',attributes:{name:'Artist'}},{id:'b',type:'albums',relationships:{coverArt:{data:[{id:'c',type:'artworks'}]}}},{id:'c',type:'artworks',attributes:{files:[{href:'https://resources.tidal.com/images/cover.jpg',meta:{width:80}}]}}];
 const rows=resources({data:[{id:'123',type:'tracks'},{id:'123',type:'tracks'}],included});assert.equal(rows.length,2);
 assert.deepEqual(normalizeResource(rows[0],included),{id:'123',type:'tracks',name:'Track',artists:['Artist'],duration:192.5,image:'https://resources.tidal.com/images/cover.jpg'});
 assert.equal(durationSeconds('PT1H2M3S'),3723);assert.equal(durationSeconds('garbage'),0);
 assert.equal(artworkURL('https://resources.tidal.com.evil.test/cover'),null);
 assert.equal(playlistID('https://tidal.com/browse/playlist/550e8400-e29b-41d4-a716-446655440000'),'550e8400-e29b-41d4-a716-446655440000');
});
