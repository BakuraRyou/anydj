import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {bundledAnalysis} from '../desktop/analysis.mjs';

test('a foreign AI bundle is rejected instead of silently using partial analysis',async t=>{
  const root=await mkdtemp(join(tmpdir(),'anydj-invalid-bundle-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(join(root,'manifest.json'),JSON.stringify({version:1,platform:process.platform==='win32'?'linux':'win32',arch:process.arch}));
  await assert.rejects(bundledAnalysis(root,join(root,'user')),/passt nicht/);
});

test('a full build with missing engines fails before the DJ window opens',async t=>{
  const root=await mkdtemp(join(tmpdir(),'anydj-missing-engines-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(join(root,'manifest.json'),JSON.stringify({version:1,platform:process.platform,arch:process.arch}));
  await assert.rejects(bundledAnalysis(root,join(root,'user')),error=>error.code==='ENOENT');
});
