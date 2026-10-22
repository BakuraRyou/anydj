// PCM16 WAV and FLAC share the same quantization. FLAC uses the streamable
// subset: independent stereo, fixed predictors, Rice residuals, CRC8/CRC16.
// Format specification: https://www.rfc-editor.org/rfc/rfc9639.html
export const pcm16=value=>{const v=Math.max(-1,Math.min(1,Number.isFinite(value)?value:0));return Math.round(v*(v<0?32768:32767));};
const text=(view,at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
function wavHeader(total,rate){
 if(total*4>0xffffffff-36)throw Error('Der Mix überschreitet die WAV-Dateigrenze von 4 GB. Bitte FLAC oder MP3 wählen.');
 const bytes=new Uint8Array(44),v=new DataView(bytes.buffer);
 text(v,0,'RIFF');v.setUint32(4,36+total*4,true);text(v,8,'WAVE');text(v,12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,rate,true);v.setUint32(28,rate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);text(v,36,'data');v.setUint32(40,total*4,true);return bytes;
}
const crc=(bytes,width,polynomial)=>{let value=0;for(const byte of bytes){value^=byte<<(width-8);for(let i=0;i<8;i++)value=((value<<1)^((value&(1<<(width-1)))?polynomial:0))&((1<<width)-1);}return value;};
function codedNumber(value){
 if(value<128)return [value];let count=2;while(value>=2**(5*count+1))count++;
 const bytes=Array(count);for(let i=count-1;i>0;i--){bytes[i]=0x80+(value%64);value=Math.floor(value/64);}bytes[0]=((0xff<<(8-count))&255)+value;return bytes;
}
class Bits{
 constructor(){this.bytes=[];this.byte=0;this.used=0;}
 write(value,count){for(let i=count-1;i>=0;i--){this.byte=(this.byte<<1)|((value>>>i)&1);if(++this.used===8){this.bytes.push(this.byte);this.used=0;this.byte=0;}}}
 unary(value){while(value>=8&&this.used===0){this.bytes.push(0);value-=8;}while(value-->0)this.write(0,1);this.write(1,1);}
 finish(){if(this.used)this.write(0,8-this.used);return this.bytes;}
}
function subframe(bits,samples,length){
 if(samples.subarray(0,length).every(v=>v===samples[0])){bits.write(0,8);bits.write(samples[0],16);return;}
 let best={cost:8+length*16,order:-1};
 for(let order=0;order<=2&&order<length;order++){
  const residual=new Uint32Array(length-order);let sum=0;
  for(let i=order;i<length;i++){const prediction=order===0?0:order===1?samples[i-1]:2*samples[i-1]-samples[i-2],r=samples[i]-prediction;residual[i-order]=r<0?-2*r-1:2*r;sum+=residual[i-order];}
  const estimate=Math.max(0,Math.min(14,Math.floor(Math.log2(sum/residual.length+1))));
  for(let k=Math.max(0,estimate-1);k<=Math.min(14,estimate+1);k++){
   let cost=18+order*16+residual.length*(1+k);for(const value of residual)cost+=value>>>k;
   if(cost<best.cost)best={cost,order,k,residual};
  }
 }
 if(best.order<0){bits.write(2,8);for(let i=0;i<length;i++)bits.write(samples[i],16);return;}
 bits.write((8+best.order)<<1,8);for(let i=0;i<best.order;i++)bits.write(samples[i],16);
 bits.write(0,6);bits.write(best.k,4);for(const value of best.residual){bits.unary(value>>>best.k);bits.write(value,best.k);}
}
function flacHeader(total,rate){
 const bytes=new Uint8Array(42),v=new DataView(bytes.buffer);text(v,0,'fLaC');bytes.set([0x80,0,0,34],4);v.setUint16(8,4096);v.setUint16(10,4096);
 const packed=(BigInt(rate)<<44n)|(1n<<41n)|(15n<<36n)|BigInt(total);
 for(let i=0;i<8;i++)bytes[18+i]=Number((packed>>BigInt(56-i*8))&255n);
 // Zero MD5 is the specified "not available" marker; frame CRCs remain present.
 return bytes;
}
function flacFrame(left,right,length,first){
 const header=[0xff,0xf9,0x79,0x18,...codedNumber(first),(length-1)>>>8,(length-1)&255];header.push(crc(header,8,0x07));
 const bits=new Bits();subframe(bits,left,length);subframe(bits,right,length);
 const body=[...header,...bits.finish()],checksum=crc(body,16,0x8005);return new Uint8Array([...body,checksum>>>8,checksum&255]);
}
export function createLosslessEncoder(format,{total,sampleRate=44100}={}){
 if(!['wav','flac'].includes(format)||sampleRate!==44100||!Number.isSafeInteger(total)||total<1||total>=2**36)throw Error('Ungültige Audio-Exportparameter.');
 const leftBlock=new Int16Array(4096),rightBlock=new Int16Array(4096);let used=0,received=0,first=0,finished=false;
 return {header:format==='wav'?wavHeader(total,sampleRate):flacHeader(total,sampleRate),
  encode(left,right){
   if(finished||left.length!==right.length||received+left.length>total)throw Error('Ungültige PCM-Daten für den Export.');received+=left.length;
   if(format==='wav'){const bytes=new Uint8Array(left.length*4),v=new DataView(bytes.buffer);for(let i=0;i<left.length;i++){v.setInt16(i*4,pcm16(left[i]),true);v.setInt16(i*4+2,pcm16(right[i]),true);}return [bytes];}
   const parts=[];for(let i=0;i<left.length;i++){leftBlock[used]=pcm16(left[i]);rightBlock[used++]=pcm16(right[i]);if(used===4096){parts.push(flacFrame(leftBlock,rightBlock,used,first));first+=used;used=0;}}return parts;
  },
  finish(){if(finished||received!==total)throw Error('Der Audioexport ist unvollständig.');finished=true;return format==='flac'&&used?[flacFrame(leftBlock,rightBlock,used,first)]:[];}
 };
}
