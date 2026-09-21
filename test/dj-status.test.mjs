import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisStatus} from '../public/dj-status.js';
test('playable tracks remain working while structure is queued or running',()=>{
 const track={plan:{},windows:[{}],refined:false};
 assert.match(analysisStatus(track).text,/Spielbereit.*wartet/);
 assert.match(analysisStatus({...track,refined:true,structureState:'running'}).text,/läuft/);
 assert.equal(analysisStatus({...track,refined:true,structureState:'running'},false).kind,'working');
});
test('only completed successful work earns full completion',()=>{
 assert.equal(analysisStatus({plan:{structure:{}},structureState:'complete'}).text,'Spielbereit');
 assert.equal(analysisStatus({plan:{},windows:[{}]},false).text,'Spielbereit');
 assert.equal(analysisStatus({plan:{},structureState:'failed',state:'Modell fehlt'}).kind,'info');
 assert.equal(analysisStatus({plan:{structure:{}},analysisWarnings:['Stilmodell fehlt']}).kind,'info');
});
test('cancelled analysis is queued again on re-enable and phases stay visible',()=>{
 const track={plan:{},windows:[{}],refined:false,structureState:'pending'};
 assert.equal(analysisStatus(track,false).kind,'complete');assert.equal(analysisStatus(track,true).kind,'working');
 assert.equal(analysisStatus({phase:'Stilverlauf wird erkannt …'}).text,'Stilverlauf wird erkannt …');
 assert.equal(analysisStatus({failed:true,state:'Decoderfehler'}).detail,'Decoderfehler');
});

test('saved optional analysis failures remain inspectable without marking playable songs as broken',()=>{
 const saved=JSON.parse(JSON.stringify({plan:{},refined:true,analysisWarnings:['Beat-Dienst nicht erreichbar','Stilmodell fehlt']}));
 const status=analysisStatus(saved,false);
 assert.equal(status.kind,'info');
 assert.match(status.text,/Spielbereit/);
 assert.match(status.detail,/Beat-Dienst nicht erreichbar/);
 assert.match(status.detail,/Stilmodell fehlt/);
 assert.equal(analysisStatus({...saved,missing:true},false).kind,'warning');
 assert.equal(analysisStatus({failed:true,state:'Audio kann nicht gelesen werden'},false).kind,'warning');
});
