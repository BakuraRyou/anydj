// Temporary preview state; never stored in the song or room plan.
export function createAnimationFocus(){
 let point=null,weight=0,last=null;
 return {
  hold(value){point={...value};},release(){point=null;},
  reset(){point=null;weight=0;last=null;this.position=null;},
  get active(){return !!point||weight>.001;},
  sample(now){
   const dt=last===null?0:Math.max(0,now-last);last=now;
   weight+=(Number(!!point)-weight)*(1-Math.exp(-dt/.35));
   if(weight<.001&&!point)weight=0;
   if(point)this.position=this.position?{x:this.position.x+(point.x-this.position.x)*(1-Math.exp(-dt/.15)),y:this.position.y+(point.y-this.position.y)*(1-Math.exp(-dt/.15))}:{...point};
   return weight&&this.position?{...this.position,weight}:null;
  }
 };
}
export function focusAnimation(lights,layout,focus){
 if(!focus?.weight)return lights;
 const heads=lights.filter(l=>l.type==='moving'&&l.target);
 if(!heads.length)return lights;
 const bottom=layout.room?0:-Math.max(4,layout.depth),margin=.08;
 // Use a fixed room anchor, not the current target centroid: re-centering
 // every frame would erase shared sweeps and turn a moving figure into a hold.
 const center={x:0,y:(bottom+layout.depth)/2},rx=layout.width/2,ry=(layout.depth-bottom)/2;
 const reach=Math.max(0,Math.min(.5,(focus.x+layout.width/2-margin)/rx,(layout.width/2-focus.x-margin)/rx,(focus.y-bottom-margin)/ry,(layout.depth-focus.y-margin)/ry));
 const target=(t,bounds)=>{
  let x=focus.x+(t.x-center.x)*reach,y=focus.y+(t.y-center.y)*reach;
  if(bounds){x=Math.max(bounds.left,Math.min(bounds.right,x));y=Math.max(bounds.bottom,Math.min(bounds.top,y));}
  const w=focus.weight;
  return {...t,x:t.x+(x-t.x)*w,y:t.y+(y-t.y)*w,z:(t.z??0)*(1-w)};
 };
 return lights.map(l=>l.type!=='moving'||!l.target?l:{...l,previewFocus:true,target:target(l.target,l.motionBounds),...(l.motionAhead?.target?{motionAhead:{...l.motionAhead,target:target(l.motionAhead.target,l.motionBounds)}}:{})});
}
