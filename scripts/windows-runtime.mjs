import {readFile,lstat,copyFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {sha256} from './desktop-downloads.mjs';
import {run} from './deploy-all-worker.mjs';

export async function readRuntimeFiles(root){
 const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
 if(manifest.schema!==1||!Array.isArray(manifest.files)||!manifest.files.length)throw Error('Microsoft-Runtime-Manifest ungültig.');
 const names=new Set();
 for(const entry of manifest.files){
  if(!/^[a-z0-9_]+\.dll$/i.test(entry.name)||names.has(entry.name.toLowerCase())||!Number.isSafeInteger(entry.size)||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Microsoft-Runtime-Datei ungültig.');
  names.add(entry.name.toLowerCase());const file=join(root,entry.name),info=await lstat(file);
  if(!info.isFile()||info.size!==entry.size||await sha256(file)!==entry.sha256)throw Error('Microsoft-Runtime-Prüfsumme stimmt nicht: '+entry.name);
 }
 for(const name of ['msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll'])if(!names.has(name))throw Error('Microsoft-Runtime unvollständig: '+name);
 return manifest;
}

export async function stageRuntime(root,destinations){
 const manifest=await readRuntimeFiles(root);
 if(process.platform==='win32'){
  const quoted="'"+root.replaceAll("'","''")+"'";
  const script="$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; foreach ($file in Get-ChildItem -LiteralPath "+quoted+" -Filter '*.dll') { $signature=Get-AuthenticodeSignature $file.FullName; if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft') { throw ('Invalid Microsoft runtime signature: '+$file.Name) } }";
  await run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')]);
 }
 for(const destination of destinations){
  await mkdir(destination,{recursive:true});
  for(const entry of manifest.files)await copyFile(join(root,entry.name),join(destination,entry.name));
 }
}
