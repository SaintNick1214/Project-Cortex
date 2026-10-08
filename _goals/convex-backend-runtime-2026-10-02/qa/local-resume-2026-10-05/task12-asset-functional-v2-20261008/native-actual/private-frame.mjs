/** Deterministic real PNG fixture. No model call, image analysis, URL, or external download. */
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
export function privateFramePng(){
 const width=512,height=512,pixels=Buffer.alloc(height*(1+width*3));
 for(let y=0;y<height;y++){const start=y*(1+width*3);pixels[start]=0;for(let x=0;x<width;x++){const at=start+1+x*3;pixels[at]=96;pixels[at+1]=132;pixels[at+2]=168;}}
 const crc=bytes=>{let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);}return(value^0xffffffff)>>>0;};
 const chunk=(name,data)=>{const type=Buffer.from(name),value=Buffer.alloc(12+data.length);value.writeUInt32BE(data.length);type.copy(value,4);data.copy(value,8);value.writeUInt32BE(crc(Buffer.concat([type,data])),8+data.length);return value;};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
 const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels,{level:9})),chunk('IEND',Buffer.alloc(0))]);assert.ok(bytes.length<=4096);return bytes;
}
