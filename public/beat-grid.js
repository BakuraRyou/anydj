// Shared validation for model output and worker input. Times remain unquantized.
export function validateBeatGrid(value, duration) {
  if (!value || value.source !== 'beat-this' || value.version !== 1 ||
      !Number.isFinite(duration) || duration <= 0 ||
      !Number.isFinite(value.duration) || Math.abs(value.duration-duration) > .01) {
    throw Error('Beat-Analyse passt nicht zu diesem Lied.');
  }
  for (const key of ['beats','downbeats']) {
    const times=value[key];
    if(!Array.isArray(times)||times.length>12000||times.some((t,i)=>!Number.isFinite(t)||t<0||t>=duration||(i>0&&t<=times[i-1]))) {
      throw Error('Ungültige Beat-Zeitpunkte.');
    }
  }
  let index=0;
  for(const t of value.downbeats) {
    while(index<value.beats.length&&value.beats[index]<t-.03)index++;
    if(index===value.beats.length||Math.abs(value.beats[index]-t)>.03)throw Error('Taktanfang ohne passenden Beat.');
  }
  return {version:1,source:'beat-this',duration,beats:[...value.beats],downbeats:[...value.downbeats]};
}
