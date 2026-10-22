import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {answerFile,initOptions,defaults} from '../scripts/init-apps.mjs';
import {validateMacConfig} from '../scripts/release-mac-remote.mjs';

test('init options require media/checksum values and reject unknown options',()=>{
 assert.deepEqual(initOptions(['--prepare-only']),{'prepare-only':true});
 assert.equal(initOptions(['--iso','Windows.iso','--accept-windows-license']).iso,'Windows.iso');
 for(const args of [['--iso'],['--iso-sha256','nope'],['--destroy'],['--iso','--check']])assert.throws(()=>initOptions(args));
});
test('unattended installer targets only the new VM disk and creates a non-admin build user',()=>{
 const xml=answerFile({user:defaults.user,password:'secret&<value>'});
 assert.match(xml,/<DiskID>0<\/DiskID>/);
 assert.match(xml,/<Group>Users<\/Group>/);
 assert.match(xml,/secret&amp;&lt;value&gt;/);
 assert.match(xml,/C:\\AnyDjInit\\schedule.ps1/);
 assert.match(xml,/<Type>EFI<\/Type>/);
 assert.doesNotMatch(xml,/<Group>Administrators<\/Group>|BypassTPM|BypassSecureBoot/);
 assert.ok(xml.trimEnd().endsWith('</unattend>'));
});
test('bootstrap restricts SSH to the dedicated key user and verifies vendor installers',async()=>{
 const script=await readFile(new URL('../scripts/vm/windows-bootstrap.ps1',import.meta.url),'utf8');
 assert.match(script,/PasswordAuthentication no/);
 assert.match(script,/AllowUsers \$user/);
 assert.match(script,/Get-AuthenticodeSignature/);
 assert.match(script,/Get-FileHash.*SHA256/);
});
test('Mac SSH configuration rejects commands and traversal paths',()=>{
 const config={host:'mac.local',user:'build',buildRoot:'/Users/build/AnyDjBuild'};
 assert.equal(validateMacConfig(config).port,22);
 for(const change of [{host:'mac;rm'},{user:'-option'},{buildRoot:'/Users/build/../secret'},{port:65536}])assert.throws(()=>validateMacConfig({...config,...change}));
});
