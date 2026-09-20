const clamp = v => Math.max(0, Math.min(1, v));
// Offline spectrum: channel powers are combined without cancelling stereo phase.
export class SpectralAnalysis {
  constructor(rate, size = 2048) {
    this.rate = rate; this.size = size;
    this.real = new Float64Array(size); this.imag = new Float64Array(size); this.power = new Float64Array(size / 2);
    this.window = Float64Array.from({length:size},(_,i)=>0.5-0.5*Math.cos(2*Math.PI*i/(size-1)));
  }
  at(channels, center) {
    const n=this.size, re=this.real, im=this.imag, power=this.power; power.fill(0);
    for(const channel of channels) {
      for(let i=0;i<n;i++) { re[i]=(channel[center+i-n/2]||0)*this.window[i]; im[i]=0; }
      for(let i=1,j=0;i<n;i++) {
        let bit=n>>1; for(;j&bit;bit>>=1)j^=bit; j^=bit;
        if(i<j) {const value=re[i];re[i]=re[j];re[j]=value;}
      }
      for(let size=2;size<=n;size*=2) {
        const angle=-2*Math.PI/size, wr=Math.cos(angle), wi=Math.sin(angle);
        for(let start=0;start<n;start+=size) {
          let r=1,m=0;
          for(let j=0;j<size/2;j++) {
            const a=start+j,b=a+size/2,tr=r*re[b]-m*im[b],ti=r*im[b]+m*re[b];
            re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
            const next=r*wr-m*wi;m=r*wi+m*wr;r=next;
          }
        }
      }
      for(let k=0;k<power.length;k++)power[k]+=(re[k]*re[k]+im[k]*im[k])/channels.length;
    }
    const bands=[0,0,0,0,0],chroma=Array(12).fill(0);
    let logSum=0,binCount=0;
    let melodySum=0,melodyPeak=Math.ceil(180*n/this.rate);
    let sum=0,weighted=0,peak=Math.ceil(65*n/this.rate);
    for(let k=Math.ceil(40*n/this.rate);k<Math.min(power.length,6000*n/this.rate);k++) {
      if(k*this.rate/n>=180&&k*this.rate/n<=1800){melodySum+=power[k];if(power[k]>power[melodyPeak])melodyPeak=k;}
      const hz=k*this.rate/n;
      bands[hz<180?0:hz<500?1:hz<1500?2:hz<3500?3:4]+=power[k];
      logSum+=Math.log(power[k]+1e-20);binCount++;
      if(hz>=180&&hz<=3500)chroma[((Math.round(69+12*Math.log2(hz/440))%12)+12)%12]+=Math.sqrt(power[k]);
      sum+=power[k];weighted+=power[k]*k*this.rate/n;
      if(k*this.rate/n>=65&&k*this.rate/n<=2000&&power[k]>power[peak])peak=k;
    }
    if(sum<0.001)return {tone:0,pitchClass:0,tonality:0,bands:[0,0,0,0,0],chroma:Array(12).fill(0),flatness:0,rolloff:0,harmonicHue:0,harmonicConfidence:0};
    const bandRatios=bands.map(v=>v/sum),chromaSum=chroma.reduce((a,b)=>a+b,0);
    const profile=chroma.map(v=>melodySum>sum*0.01?v/Math.max(1e-20,chromaSum):0);
    let cx=0,cy=0;profile.forEach((v,i)=>{const angle=(i*7%12)/12*2*Math.PI;cx+=v*Math.cos(angle);cy+=v*Math.sin(angle);});
    let accumulated=0,rolloff=0;
    for(let k=Math.ceil(40*n/this.rate);k<power.length;k++){accumulated+=power[k];if(accumulated>=sum*0.85){rolloff=clamp(Math.log(Math.max(80,k*this.rate/n)/80)/Math.log(6000/80));break;}}
    const flatness=clamp(Math.exp(logSum/Math.max(1,binCount))/(sum/Math.max(1,binCount)));
    const left=Math.log(power[peak-1]+1e-20),middle=Math.log(power[peak]+1e-20),right=Math.log(power[peak+1]+1e-20);
    const delta=Math.max(-0.5,Math.min(0.5,0.5*(left-right)/(left-2*middle+right)||0));
    const frequency=Math.max(1,(peak+delta)*this.rate/n);
    const pitch=((69+12*Math.log2(frequency/440))%12+12)%12/12;
    const ml=Math.log(power[melodyPeak-1]+1e-20),mm=Math.log(power[melodyPeak]+1e-20),mr=Math.log(power[melodyPeak+1]+1e-20);
    const md=Math.max(-0.5,Math.min(0.5,0.5*(ml-mr)/(ml-2*mm+mr)||0));
    const melodyFrequency=(melodyPeak+md)*this.rate/n;
    return {bands:bandRatios,chroma:profile,flatness,rolloff,
      harmonicHue:(Math.atan2(cy,cx)/(2*Math.PI)+1)%1,harmonicConfidence:clamp(Math.hypot(cx,cy)),
      melodyTone:clamp(Math.log(Math.max(180,melodyFrequency)/180)/Math.log(10)),
      melodyConfidence:melodySum>0.001&&melodySum>sum*0.01?clamp((power[melodyPeak-1]+power[melodyPeak]+power[melodyPeak+1])/melodySum):0,
      tone:clamp(Math.log(Math.max(80,weighted/sum)/80)/Math.log(6000/80)),pitchClass:pitch,
      tonality:clamp(((power[peak-1]||0)+power[peak]+(power[peak+1]||0))/sum)};
  }
}

export function spectralFlux(previous, current) {
  if (!previous) return 0;
  return clamp(current.bands.reduce((sum,v,k)=>sum+Math.max(0,v-previous.bands[k]),0)*0.65+
    current.chroma.reduce((sum,v,k)=>sum+Math.max(0,v-previous.chroma[k]),0)*0.35);
}
