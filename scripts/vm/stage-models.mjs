import {readFile,realpath,cp,mkdir,stat} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {sha256} from '../desktop-downloads.mjs';
export async function stageModels(root,destination){
 const source=join(root,'data');
 const copyVerified=async(relative,expected)=>{
  const file=join(source,...relative.split('/'));const base=await realpath(source),actual=await realpath(file);
  if(!actual.startsWith(base+sep)||await sha256(actual)!==expected)throw Error('Modell-Prüfsumme oder Modellpfad ungültig: '+relative);
  const target=join(destination,...relative.split('/'));await mkdir(resolve(target,'..'),{recursive:true});await cp(actual,target);
 };
 await copyVerified('beat-this/final0.ckpt','8c328b45f59d8dd3dff219253ff6a8d6482be57d0133a29140e2febbf8eb8331');
 await copyVerified('style/discogs-effnet.onnx','a280825b334797cf677939db8cd5762c0392aedd0ca6415dbc1cd083f045e43c');
 await copyVerified('style/metadata.json','1e140159496f7f932e4267b478e246bd60fbd526a7a67d3e12684a2978916420');
 const manifest=JSON.parse(await readFile(join(source,'structure','ready.json'),'utf8'));
 if(manifest.version!==1||manifest.model!=='harmonix-all'||manifest.separator!=='htdemucs'||manifest.weights?.length!==9)throw Error('Vollständiger Struktur-Modellcache fehlt.');
 const allowed=/^(?:huggingface\/hub\/models--taejunkim--allinone\/snapshots\/[a-f0-9]{40}\/harmonix-fold[0-7]-[a-z0-9]+\.pth|torch\/hub\/checkpoints\/955717e8-8726e21a\.th)$/;
 for(const entry of manifest.weights){
  const path=entry.path.replaceAll('\\','/');if(!allowed.test(path)||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Unzulässiger Struktur-Modellpfad.');
  await copyVerified('structure/'+path,entry.sha256);
 }
 const refs=join(destination,'structure','huggingface','hub','models--taejunkim--allinone','refs');await mkdir(refs,{recursive:true});
 const {writeFile}=await import('node:fs/promises');
 const snapshots=[...new Set(manifest.weights.filter(e=>e.path.startsWith('huggingface/')).map(e=>e.path.split('/')[4]))];if(snapshots.length!==1)throw Error('Mehrdeutiger Modell-Snapshot.');
 await writeFile(join(refs,'main'),snapshots[0]);
 await cp(join(source,'structure','ready.json'),join(destination,'structure','ready.json'));
 console.log('Verifizierte öffentliche Modelle für Windows bereitgestellt; keine privaten Hostdaten.');
}
