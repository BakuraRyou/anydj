import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateStorageKey,migrateLibraryDatabase} from '../public/storage-migration.js';

function storage(entries){
  const data=new Map(entries);
  return {data,get length(){return data.size;},key:index=>[...data.keys()][index],
    getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
}
test('previous preferences move to current names without overwriting newer values',()=>{
  const old=storage([['previous-dj-show-profile','party'],['unrelated','value']]);
  assert.equal(migrateStorageKey(old,'anydj-dj-show-profile','-dj-show-profile'),'party');
  assert.deepEqual([...old.data],[['unrelated','value'],['anydj-dj-show-profile','party']]);
  old.setItem('previous-dj-show-profile','disco');
  assert.equal(migrateStorageKey(old,'anydj-dj-show-profile','-dj-show-profile'),'party');
  assert.equal(old.getItem('previous-dj-show-profile'),null);
});
test('a failed write retains previous data and still returns the usable value',()=>{
  const old=storage([['previous-web-token','saved-access-code']]);
  old.setItem=()=>{throw Error('Storage unavailable');};
  assert.equal(migrateStorageKey(old,'anydj-web-token','-web-token'),'saved-access-code');
  assert.equal(old.getItem('previous-web-token'),'saved-access-code');
});
test('unsupported discovery and failed copies do not delete previous libraries',async()=>{
  await assert.rejects(migrateLibraryDatabase({},{}),/Browser/);
  let closed=false,deleted=false;
  const source={objectStoreNames:[],close(){closed=true;}};
  const factory={databases:async()=>[{name:'previous-dj-library'}],open(){
    const request={result:source};queueMicrotask(()=>request.onsuccess());return request;
  },deleteDatabase(){deleted=true;throw Error('Must not delete');}};
  // A destination schema failure must leave the previous database in place.
  source.objectStoreNames=['custom'];
  source.transaction=()=>{throw Error('Read failed');};
  await assert.rejects(migrateLibraryDatabase(factory,{name:'anydj-dj-library'}),/Read failed/);
  assert.equal(closed,true);assert.equal(deleted,false);
});
