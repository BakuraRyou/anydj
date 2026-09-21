import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedShowMatches,showSignature} from '../public/dj-library.js';
import {SHOW_PLAN_VERSION} from '../public/show-plan.js';
const track={name:'song.mp3',size:1234,lastModified:5678};
const options={arrangement:'auto',minimum:5,maximum:75};
const record=()=>({signature:showSignature(track,options),plan:{version:SHOW_PLAN_VERSION,duration:12,frames:[{r:2,g:3,b:4,dimming:5}]}});
test('cached shows require matching file metadata, design and generation version',()=>{
 assert.ok(cachedShowMatches(record(),track,options));
 for(const change of [{name:'other.mp3'},{size:1235},{lastModified:5679}])assert.ok(!cachedShowMatches(record(),{...track,...change},options));
 assert.ok(!cachedShowMatches(record(),track,{...options,maximum:90}));
 const old=record();old.plan.version--;assert.ok(!cachedShowMatches(old,track,options));
 const stale=record();stale.signature='old';assert.ok(!cachedShowMatches(stale,track,options));
});
test('missing and incomplete cached plans fall back to analysis',()=>{
 for(const value of [null,{}, {...record(),plan:null}, {...record(),plan:{...record().plan,frames:[]}}, {...record(),plan:{...record().plan,duration:NaN}}])assert.ok(!cachedShowMatches(value,track,options));
});
