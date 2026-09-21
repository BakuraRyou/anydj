import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server.mjs';
import {authorization,callbackURL,validateCallback,createSpotifyClient,apiURL,spotifyImage,spotifyTrack,playlistID,localSuggestions,TOKEN_URL} from '../public/spotify-client.js';
const storage=()=>{const entries=new Map();return {getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};};
const token={clientId:'a'.repeat(32),access_token:'access',refresh_token:'refresh',expiresAt:Date.now()+3600000};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers});

test('PKCE uses S256 and validates state, age, denial and callback origins',async()=>{
  assert.equal(callbackURL('https://example.org/anydj/dj.html'),'https://example.org/anydj/spotify-callback.html');
  assert.equal(callbackURL('http://127.0.0.1:3000/dj'),'http://127.0.0.1:3000/spotify-callback.html');
  assert.equal(callbackURL('https://127.0.0.1:3030/dj'),'https://127.0.0.1:3030/spotify-callback.html');
  assert.throws(()=>callbackURL('https://localhost:3030/dj'),/https:\/\/127\.0\.0\.1:3030\/dj/);
  for(const url of ['http://localhost:3000/dj','http://192.168.1.2/dj','file:///dj.html'])assert.throws(()=>callbackURL(url));
  const {url,pending}=await authorization(token.clientId,'https://example.org/spotify-callback.html','channel');
  const params=new URL(url).searchParams;
  assert.equal(params.get('code_challenge_method'),'S256');assert.equal(params.get('code_challenge').length,43);
  assert.equal(params.get('scope').includes('streaming'),true);assert.ok(!params.has('client_secret'));
  const callback=`https://example.org/spotify-callback.html?code=code&state=${pending.state}`;
  assert.equal(validateCallback(callback,pending).code_verifier,pending.verifier);
  assert.throws(()=>validateCallback(callback,{...pending,state:'wrong'}));
  assert.throws(()=>validateCallback(callback,pending,pending.created+600001));
  assert.throws(()=>validateCallback(callback,null));
  assert.throws(()=>validateCallback(`https://example.org/?error=access_denied&state=${pending.state}`,pending),/abgebrochen/);
});
test('does not send bearer tokens to foreign pagination URLs',async()=>{
  let requests=0;const client=createSpotifyClient({storage:storage(),fetcher:async()=>{requests++;return json({});}});client.install(token);
  for(const url of ['https://evil.test/v1/tracks','https://api.spotify.com.evil.test/v1/tracks','https://api.spotify.com/elsewhere','https://user:pass@api.spotify.com/v1/me'])await assert.rejects(client.get(url));
  assert.equal(requests,0);assert.equal(apiURL('me/playlists?limit=50'),'https://api.spotify.com/v1/me/playlists?limit=50');
});
test('refreshes concurrent requests once, preserving rotated refresh token',async()=>{
  const store=storage();let refreshes=0;
  const client=createSpotifyClient({storage:store,fetcher:async(url,options)=>{
    if(url===TOKEN_URL){refreshes++;await new Promise(r=>setTimeout(r,10));assert.equal(options.body.get('refresh_token'),'refresh');return json({access_token:'new',refresh_token:'rotated',expires_in:3600});}
    assert.equal(options.headers.Authorization,'Bearer new');return json({items:[]});
  }});
  client.install({...token,expiresAt:0});await Promise.all([client.get('me/playlists'),client.get('me/tracks')]);assert.equal(refreshes,1);
  assert.equal(JSON.parse(store.getItem('anydj-spotify-session')).refresh_token,'rotated');
});
test('retries a rejected access token once and disconnects on repeated 401',async()=>{
  let gets=0;
  const client=createSpotifyClient({storage:storage(),fetcher:async url=>url===TOKEN_URL?json({access_token:'new',expires_in:3600}):(gets++,json({},401))});
  client.install(token);await assert.rejects(client.get('me/playlists'),/abgelaufen/);assert.equal(gets,2);assert.equal(client.connected,false);
});
test('disconnect during refresh cannot resurrect account',async()=>{
  let finish;const client=createSpotifyClient({storage:storage(),fetcher:()=>new Promise(resolve=>{finish=resolve;})});
  client.install({...token,expiresAt:0});const request=client.get('me/playlists');client.disconnect();finish(json({access_token:'late',expires_in:3600}));
  await assert.rejects(request,/geändert/);assert.equal(client.connected,false);
});
test('respects Retry-After without hammering API and explains restricted playlists',async()=>{
  let requests=0;const client=createSpotifyClient({storage:storage(),fetcher:async()=>{requests++;return json({},429,{'Retry-After':'120'});}});client.install(token);
  await assert.rejects(client.get('me/playlists'),/120 Sekunden/);await assert.rejects(client.get('me/playlists'),/pausiert/);assert.equal(requests,1);
  const denied=createSpotifyClient({storage:storage(),fetcher:async()=>json({},403)});denied.install(token);await assert.rejects(denied.get('playlists/id/items'),/gemeinsam/);
});
test('accepts new and legacy playlist items, skips unsupported entries, preserves versions',()=>{
  const raw={id:'abc',type:'track',name:'Song (Live)',artists:[{name:'Artist'}],duration_ms:180000};
  assert.deepEqual(spotifyTrack({item:raw}),spotifyTrack({track:raw}));assert.equal(spotifyTrack({item:null}),null);
  assert.equal(spotifyTrack({...raw,is_local:true}),null);assert.equal(spotifyTrack({...raw,type:'episode'}),null);
  const suggestions=localSuggestions(spotifyTrack(raw),[{id:'1',name:'Artist - Song.mp3'},{id:'2',name:'Artist - Song (Live).flac'},{id:'3',name:'Artist - Song (Live).mp3',missing:true}]);
  assert.deepEqual(suggestions.map(t=>t.id),['2']);
  const id='A'.repeat(22);assert.equal(playlistID(`https://open.spotify.com/playlist/${id}?si=x`),id);assert.equal(playlistID('spotify:playlist:'+id),id);assert.equal(playlistID('https://evil.test/playlist/'+id),null);
});
test('only cross-site document navigation to callback is exempt from local request protection',async t=>{
  const app=await createApp({demo:true});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  t.after(()=>new Promise(resolve=>{app.server.closeAllConnections();app.server.close(resolve);}));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  // Native fetch fixes Sec-Fetch-Mode to cors; use http for navigation headers.
  const {get}=await import('node:http');
  const request=(path,headers)=>new Promise(resolve=>{get(base+path,{headers},res=>{res.resume();res.on('end',()=>resolve(res));});});
  const headers={'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'};
  assert.equal((await request('/spotify-callback.html?code=x',headers)).statusCode,200);
  assert.equal((await request('/api/devices',headers)).statusCode,403);
  assert.equal((await request('/spotify-callback.html',{...headers,'Sec-Fetch-Mode':'cors'})).statusCode,403);
  for(const path of ['/spotify-client.js','/spotify-library.js','/spotify-auth.js','/spotify-library.css'])assert.equal((await fetch(base+path)).status,200);
});


test('Spotify artwork accepts provider CDNs and preserves album images',()=>{
 const images=[{url:'https://i.scdn.co/image/large',width:640},{url:'https://i.scdn.co/image/small',width:64}];
 assert.equal(spotifyImage(images),'https://i.scdn.co/image/small');
 assert.equal(spotifyImage([{url:'https://mosaic.scdn.co/playlist'}]),'https://mosaic.scdn.co/playlist');
 for(const url of ['http://i.scdn.co/image/x','https://evil.test/x','https://i.scdn.co.evil.test/x','https://user:pass@i.scdn.co/x','javascript:alert(1)'])assert.equal(spotifyImage([{url}]),null);
 assert.equal(spotifyImage(null),null);
 assert.equal(spotifyTrack({id:'test',type:'track',album:{images}}).image,'https://i.scdn.co/image/small');
});


test('playback requests use PUT, refreshed access and accept empty 204 responses',async()=>{
 const calls=[];
 const client=createSpotifyClient({storage:storage(),fetcher:async(url,options)=>{calls.push({url,options});return new Response(null,{status:204});}});
 client.install({...token,scope:'streaming user-read-email user-read-private user-modify-playback-state'});
 assert.equal(client.canStream,true);
 await client.request('me/player/play?device_id=test',{method:'PUT',body:{uris:['spotify:track:'+'a'.repeat(22)]}});
 assert.equal(calls[0].options.method,'PUT');assert.equal(calls[0].options.headers.Authorization,'Bearer access');
 assert.equal(JSON.parse(calls[0].options.body).uris.length,1);
 client.install(token);assert.equal(client.canStream,false);
});
