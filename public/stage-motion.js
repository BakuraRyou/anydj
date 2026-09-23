// Movement character uses temporal contrast and selected rhythmic evidence,
// not absolute loudness. A quiet groove can remain rhythmic; a loud pad can rest.
export function phraseMovement(windows,phrase,arrangement){
 const local=windows.slice(Math.max(0,Math.floor(phrase.start/.02)),Math.min(windows.length,Math.ceil(phrase.end/.02)));
 const rms=local.map(w=>Math.max(0,Number.isFinite(w.rms)?w.rms:0)).sort((a,b)=>a-b);
 const low=rms[Math.floor(rms.length*.2)]||0,high=rms[Math.min(rms.length-1,Math.floor(rms.length*.95))]||0;
 const contrast=high>.003?(high-low)/high:0;
 const events=arrangement.times.flatMap((time,i)=>time>=phrase.start&&time<phrase.end?[arrangement.patterns.events[i]]:[]);
 const driving=events.length?events.filter(e=>e?.driving).length/events.length:0;
 const rate=events.length/Math.max(.1,phrase.end-phrase.start);
 const rhythmic=rate>=.8&&driving>=.5;
 const atmospheric=!rhythmic&&(phrase.kind==='wash'||phrase.kind==='sweep'||contrast<.25||rate<.8);
 return {character:rhythmic?'rhythmic':atmospheric?'atmospheric':'flowing',contrast,driving,rate};
}
export function stageMotionAt(plan,time){
 return plan?.arrangement?.patterns?.phrases?.find(p=>time>=p.start&&time<p.end)?.movement?.character||null;
}
