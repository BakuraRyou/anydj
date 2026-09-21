import test from 'node:test';
import assert from 'node:assert/strict';
import {setupNetworkStatus} from '../lib/connection.mjs';
const mac='a8bb5074d27c';
test('Einrichtungsnetz wird auf der konfigurierten WLAN-Schnittstelle frisch gesucht',async()=>{
 let args;
 const result=await setupNetworkStatus(mac,{interfaceName:'wlo1',execute:async(_command,a)=>{args=a;return {stdout:'Home\nWiZConfig_d27c\n'};}});
 assert.equal(result.visible,true);assert.equal(result.code,'SETUP_VISIBLE');
 assert.deepEqual(args.slice(-4),['ifname','wlo1','--rescan','yes']);
});
test('Fehlendes Einrichtungsnetz und fehlgeschlagener Scan sind unterschiedliche Zustände',async()=>{
 const absent=await setupNetworkStatus(mac,{execute:async()=>({stdout:'Home\n'})});
 const failed=await setupNetworkStatus(mac,{execute:async()=>{throw Error('private detail');}});
 assert.equal(absent.code,'SETUP_NOT_VISIBLE');assert.equal(failed.code,'WIFI_SCAN_FAILED');
 assert.equal(JSON.stringify(failed).includes('private detail'),false);
});
test('Ungültige Identität löst keinen Netzwerkscan aus',async()=>{
 const result=await setupNetworkStatus('invalid',{execute:async()=>{throw Error('must not execute');}});
 assert.equal(result.code,'UNKNOWN_IDENTITY');
});
