// Draw each available local title once per round; current/queued titles stay excluded.
export function createShufflePicker(random=Math.random){
  const seen=new Set();
  return {
    reset(){seen.clear();},
    next(tracks,excluded=[]){
      const blocked=new Set(excluded);
      const available=tracks.filter(t=>!t.deleted&&!t.missing&&!t.pendingChange&&!t.failed&&!t.queuePreparationError&&(t.file||t.handle));
      const ids=new Set(available.map(t=>t.id));
      for(const id of seen)if(!ids.has(id))seen.delete(id);
      for(const id of blocked)if(ids.has(id))seen.add(id);
      let choices=available.filter(t=>!blocked.has(t.id)&&!seen.has(t.id));
      if(!choices.length){
        if(available.some(t=>!seen.has(t.id)))return null;
        choices=available.filter(t=>!blocked.has(t.id));
        if(!choices.length)return null;
        seen.clear();for(const id of blocked)if(ids.has(id))seen.add(id);
      }
      const track=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
      if(!track)return null;
      seen.add(track.id);return track;
    }
  };
}
