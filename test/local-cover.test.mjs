import test from 'node:test';
import assert from 'node:assert/strict';
import {embeddedCover} from '../public/local-cover.js';
const txt=s=>Buffer.from(s,'latin1'),u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
const sync=n=>Buffer.from([n>>21&127,n>>14&127,n>>7&127,n&127]);
const png=Buffer.from('89504e470d0a1a0a001234','hex');
const atom=(name,data)=>Buffer.concat([u32(data.length+8),txt(name),data]);
function id3(version=3,image=png,type=3){
 const body=Buffer.concat([Buffer.from([0]),txt('image/png\0'),Buffer.from([type,0]),image]);
 const frame=Buffer.concat([txt('APIC'),version===4?sync(body.length):u32(body.length),Buffer.alloc(2),body]);
 return Buffer.concat([txt('ID3'),Buffer.from([version,0,0]),sync(frame.length),frame]);
}
async function matches(data){const result=embeddedCover(data);assert.equal(result?.type,'image/png');assert.deepEqual(Buffer.from(await result.arrayBuffer()),png);}
test('reads ID3 v2.3 and v2.4 embedded covers; rejects linked and truncated artwork',async()=>{
 await matches(id3());await matches(id3(4));assert.equal(embeddedCover(id3(3,txt('https://example.com/a.png'))),null);
 assert.equal(embeddedCover(id3().subarray(0,18)),null);
});
test('reads FLAC picture metadata and M4A covr atoms',async()=>{
 const body=Buffer.concat([u32(3),u32(9),txt('image/png'),u32(0),Buffer.alloc(16),u32(png.length),png]);
 const flac=Buffer.concat([txt('fLaC'),Buffer.from([134,body.length>>16,body.length>>8&255,body.length&255]),body]);await matches(flac);
 const m4a=Buffer.concat([atom('ftyp',txt('M4A ')),atom('moov',atom('udta',atom('meta',Buffer.concat([Buffer.alloc(4),atom('ilst',atom('covr',atom('data',Buffer.concat([u32(14),u32(0),png]))))]))))]);await matches(m4a);
 assert.equal(embeddedCover(m4a.subarray(0,m4a.length-1)),null);
});
test('reads ID3 artwork in WAV chunks, handles absent and malformed tags',async()=>{
 const tag=id3(),size=Buffer.alloc(4);size.writeUInt32LE(tag.length);
 const wav=Buffer.concat([txt('RIFF'),Buffer.alloc(4),txt('WAVEid3 '),size,tag]);await matches(wav);
 for(const data of [Buffer.alloc(0),txt('ordinary audio'),txt('fLaC'),Buffer.concat([txt('ID3'),Buffer.alloc(50)])])assert.equal(embeddedCover(data),null);
});
