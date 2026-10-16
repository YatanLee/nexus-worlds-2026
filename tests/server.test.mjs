import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('loopback readonly API and allowlisted static assets enforce boundaries',{timeout:15000},async()=>{
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',NEXUS_DISABLE_CRAWLER:'1'},stdio:['ignore','pipe','pipe']});
 try {
  const [output]=await once(child.stdout,'data'),url=String(output).match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];assert.ok(url);
  const res=await fetch(url);assert.equal(res.status,200);assert.match(await res.text(),/NEXUS/);assert.match(res.headers.get('content-security-policy'),/connect-src 'self'/);
  const snapshot=await fetch(url+'api/schedule');assert.equal(snapshot.status,200);assert.equal((await snapshot.json()).schemaVersion,2);
  assert.equal((await fetch(url+'api/status')).status,200);
  for(const route of ['tests/model.test.mjs','design/overview-concept.png','.git/config','%2e%2e%5cindex.html','crawler.mjs','data/schedule.json','.cache/crawl-status.json','api/schedule?url=https://example.com','api/refresh'])assert.equal((await fetch(url+route)).status,404,route);
  for(const route of ['','api/schedule','api/status'])assert.equal((await fetch(url+route,{method:'POST',body:'test'})).status,405);
  const head=await fetch(url+'api/schedule',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(url+'app.mjs')).status,200);assert.equal((await fetch(url+'schedule.mjs')).status,200);
 }finally{child.kill();await once(child,'exit');}
});
