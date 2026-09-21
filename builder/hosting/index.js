// Main server entry for anydj.de in Plesk/Passenger.
// Deployment switches current.json after uploading the complete web release.
'use strict';
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {pathToFileURL}=require('node:url');
async function main(){
  if(Number(process.versions.node.split('.')[0])<22)throw Error('AnyDj requires Node.js 22 or newer.');
  const {release}=JSON.parse(readFileSync(join(__dirname,'current.json'),'utf8'));
  if(typeof release!=='string'||!/^\d{14}-[a-f0-9]{12}$/.test(release))throw Error('Invalid AnyDj release manifest.');
  const root=join(__dirname,'releases',release);
  const {startHostedServer}=await import(pathToFileURL(join(root,'server.mjs')).href);
  await startHostedServer({root,appRoot:__dirname,release});
}
main().catch(error=>{console.error('AnyDj startup failed:',error.message);process.exitCode=1;});
