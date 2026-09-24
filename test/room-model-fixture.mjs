// Small room shell with a translated parent node and a colored, indexed child mesh.
export function roomGLB(change=()=>{}){
  const positions=[-4,0,0,4,0,0,4,0,-6,-4,0,-6,-4,3,0,4,3,0,4,3,-6,-4,3,-6];
  const indices=[0,2,1,0,3,2,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,4,5,6,4,6,7];
  const bin=new Uint8Array(positions.length*4+indices.length*2),view=new DataView(bin.buffer);
  positions.forEach((v,i)=>view.setFloat32(i*4,v,true));indices.forEach((v,i)=>view.setUint16(positions.length*4+i*2,v,true));
  const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{translation:[3,2,7],children:[1]},{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],materials:[{pbrMetallicRoughness:{baseColorFactor:[.25,.5,.75,1]}}],buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteLength:positions.length*4},{buffer:0,byteOffset:positions.length*4,byteLength:indices.length*2}],accessors:[{bufferView:0,componentType:5126,count:positions.length/3,type:'VEC3'},{bufferView:1,componentType:5123,count:indices.length,type:'SCALAR'}]};
  change(json,bin);
  const encoded=new TextEncoder().encode(JSON.stringify(json)),length=Math.ceil(encoded.length/4)*4,bytes=new Uint8Array(12+8+length+8+bin.length),header=new DataView(bytes.buffer);
  header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,bytes.length,true);header.setUint32(12,length,true);header.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+length);bytes.set(encoded,20);header.setUint32(20+length,bin.length,true);header.setUint32(24+length,0x004e4942,true);bytes.set(bin,28+length);
  return bytes;
}
