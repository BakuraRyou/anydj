import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {validateCatalog,validateShow} from '../public/landing-show-data.js';
export async function validateLandingShows(webRoot=fileURLToPath(new URL('../web/',import.meta.url))){
  const read=async(path,limit)=>{const bytes=await readFile(path);if(bytes.length>limit)throw Error(`Datei zu groß: ${path}`);return JSON.parse(bytes);};
  const catalog=validateCatalog(await read(join(webRoot,'demo-shows','catalog.json'),16000));
  for(const entry of catalog.shows){
    const show=validateShow(await read(join(webRoot,entry.show),4*1024*1024));
    const audio=join(webRoot,show.audio),info=await stat(audio);
    if(!info.isFile()||info.size===0||info.size>25*1024*1024)throw Error(`Audio fehlt oder ist größer als 25 MiB: ${audio}`);
  }
  return catalog;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const catalog=await validateLandingShows();console.log(`${catalog.shows.length} Demo-Shows erfolgreich geprüft.`);
}
