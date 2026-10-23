import test from 'node:test';
import assert from 'node:assert/strict';
import {safeNext,checkImage,imageKind} from '../src/lib/security.mjs';
test('redirects accept local destinations',()=>{assert.equal(safeNext('/dashboard'),'/dashboard');assert.equal(safeNext('/projects/hello?x=1'),'/projects/hello?x=1');});
test('redirects reject alternate origins and browser URL normalization traps',()=>{
 for(const input of ['https://evil.test','//evil.test','/\\evil.test','\\evil.test','/\n/evil.test','/\t/evil.test',null,undefined,'']) assert.equal(safeNext(input),'/dashboard');
});
test('uploads detect PNG JPEG and WebP signatures',()=>{
 assert.equal(checkImage(Uint8Array.from([137,80,78,71,13,10,26,10]),'image/png').ext,'png');
 assert.equal(checkImage(Uint8Array.from([255,216,255,224]),'image/jpeg').ext,'jpg');
 assert.equal(checkImage(new TextEncoder().encode('RIFF0000WEBP'),'image/webp').ext,'webp');
});
test('uploads reject executable formats, empty content, and spoofed MIME',()=>{
 assert.throws(()=>checkImage(new TextEncoder().encode('<svg onload=alert(1)>'),'image/png'));
 assert.throws(()=>checkImage(new Uint8Array(),'image/png'));
 assert.equal(checkImage(Uint8Array.from([255,216,255]),'image/png').ext,'jpg'); // bytes win over the declared type
 assert.equal(imageKind(new Uint8Array([1,2,3])),null);
});
test('uploads enforce 5 MB before storage',()=>{assert.throws(()=>checkImage(new Uint8Array(5*1024*1024+1),'image/png'),/5 MB/);});
