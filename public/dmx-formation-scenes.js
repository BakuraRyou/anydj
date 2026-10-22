// Structural scene vocabulary: changes targets and fixture group composition,
// never colour, playback speed or the source-derived musical clock.
const families=[
 'parallel-lines','open-fan','crossed-fans','split-wings','diagonal-plane','rising-arch',
 'crown','vaulted-roof','layered-steps','lattice','braided-ribbons','twin-fans','diamond',
 'nested-gates','traveling-wave','converging-lines','radial-wheel','double-helix','folding-blades',
 'horizontal-sheets','vertical-curtain','crossed-sheets','spiral-shell','split-foci',
 'chevron-stack','hourglass','portal-rows','folded-roof','opposed-diagonals','rake','split-curtain','concentric-fans'
];
const layouts=[
 {id:'ensemble',name:'Gesamtbild',motions:['relay','dialogue','weave','suspend','bloom','gather']},
 {id:'terraces',name:'Drei Höhenebenen',motions:['relay','weave','suspend','bloom','gather']},
 {id:'wings',name:'Zwei getrennte Flügel',motions:['dialogue','weave','bloom','gather']},
 {id:'corridor',name:'Offener Mittelkorridor',motions:['relay','weave','bloom']},
 {id:'islands',name:'Vier Lichtgruppen',motions:['relay','dialogue','weave']}
];
export const FORMATION_SCENES=Object.freeze(families.flatMap(shape=>layouts.map(layout=>Object.freeze({
 id:`${shape}/${layout.id}`,shape,layout:layout.id,name:`${shape} · ${layout.name}`,motions:Object.freeze([...layout.motions])
}))));
const byShape=new Map(families.map(shape=>[shape,FORMATION_SCENES.filter(scene=>scene.shape===shape)]));
export function chooseFormationScene(shape,motion,evidence,phrase=0){
 const candidates=(byShape.get(shape)??[]).filter(scene=>scene.motions.includes(motion));
 if(!candidates.length)return null;
 // Sparse, held or voice-led music keeps clear open space; dense percussion
 // can carry a multi-group picture. Phrase history only breaks eligible ties.
 let preferred=evidence?.texture==='voice'?'wings':evidence?.texture==='bass'?'corridor'
  :evidence?.density>.65&&evidence?.energy>.5?'islands':evidence?.pitchConfidence>.45?'terraces':'ensemble';
 const eligible=candidates.filter(scene=>scene.layout!=='islands'||evidence?.density>.35&&evidence?.energy>.3)
  .filter(scene=>scene.layout!=='corridor'||evidence?.texture!=='voice');
 const first=Math.max(0,eligible.findIndex(scene=>scene.layout===preferred));
 return eligible[(first+Math.max(0,Math.floor(phrase)))%eligible.length]??candidates[0];
}

export function formationScenePose(scene,pose,rank,count,row,groups){
 if(!scene||count<4)return {...pose,membership:1};
 const u=rank/Math.max(1,count-1),layer=row/Math.max(1,groups-1),side=u<.5?-1:1;
 let {x,y}=pose,membership=1;
 switch(scene.layout){
  case 'terraces':
   // Each mounting row owns a complete miniature picture at a distinct height.
   x=.5+(x-.5)*.8;y=.16+layer*.56+(y-.5)*.22;break;
  case 'wings':
   x=.5+side*.28+(x-.5)*.36;y=.5+(y-.5)*.8;
   // Keep the central seam open, with symmetric membership on both sides.
   membership=Math.abs(u-.5)<.09?0:1;break;
  case 'corridor':
   x=.5+side*(.2+Math.abs(x-.5)*.5);y=.18+layer*.5+(y-.5)*.25;
   membership=Math.abs(u-.5)<.16?0:1;break;
  case 'islands':{
   const bank=Math.min(3,Math.floor(u*4));
   x=.17+bank*.22+(x-.5)*.14;y=.35+(bank%2)*.24+(y-.5)*.26;
   const local=u*4-bank;
   membership=local>.12&&local<.88||rank===0||rank===count-1?1:0;
   break;
  }
 }
 return {...pose,x,y,membership};
}
