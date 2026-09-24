// Explicit, documented personalities only. Additional emitters/effects stay off.
const cameo='https://www.cameolight.com/en/downloads/file/id/821189964';
const stairville='https://images.thomann.de/pics/atg/atgdata/document/manual/215926_c_115012_115025_215918_115048_215926_115050_v3_en_online.pdf';
export const FIXTURE_LIBRARY=Object.freeze([
  {id:'chauvet-slimpar56-3',manufacturer:'CHAUVET DJ',model:'SlimPAR 56',mode:'3-CH · RGB',map:['r','g','b'],source:'https://www.chauvetdj.com/wp-content/uploads/2015/12/SlimPAR_56_UM_Rev7_WO..pdf'},
  {id:'chauvet-slimpar64-3',manufacturer:'CHAUVET DJ',model:'SlimPAR 64',mode:'3-CH · RGB',map:['r','g','b'],source:'https://www.chauvetdj.com/wp-content/uploads/2015/12/SlimPAR_64_UM_Rev6_WO.pdf'},
  {id:'cameo-flat-rgb10ir-3',manufacturer:'Cameo',model:'FLAT PAR CAN RGB 10 IR',mode:'3-Kanal-Modus 2 · RGB',map:['r','g','b'],source:cameo},
  {id:'cameo-flat-tri3wir-3',manufacturer:'Cameo',model:'FLAT PAR CAN TRI 3W IR',mode:'3-Kanal-Modus 2 · RGB',map:['r','g','b'],source:cameo},
  {id:'adj-mega-tripar-plus-4',manufacturer:'ADJ',model:'Mega TriPar Profile Plus',mode:'4CH · RGB + UV',map:['r','g','b',0],note:'RGB und Helligkeit; UV bleibt aus.',source:'https://assets.centryngroup.com/dl/files/MEGATRIPARPROFILEPLUSUSERMANUAL.pdf'},
  {id:'stairville-par56-7',manufacturer:'Stairville',model:'LED PAR 56 10 mm RGB',mode:'7 Kanäle · DIP 10–12 aus',map:['r','g','b',0,0,0,'dimmer'],source:stairville},
  {id:'stairville-par64-7',manufacturer:'Stairville',model:'LED PAR 64 10 mm RGB',mode:'7 Kanäle · DIP 10–12 aus',map:['r','g','b',0,0,0,'dimmer'],source:stairville},
].map(p=>Object.freeze({...p,map:Object.freeze(p.map),type:'spot',cells:1})));
const profiles=new Map(FIXTURE_LIBRARY.map(p=>[p.id,p]));
export const fixtureProfile=id=>profiles.get(id);
