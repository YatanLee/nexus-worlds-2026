import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('loopback readonly API and allowlisted static assets enforce boundaries',{timeout:15000},async()=>{
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',NEXUS_DISABLE_CRAWLER:'1'},stdio:['ignore','pipe','pipe']});
 try {
  const [output]=await once(child.stdout,'data'),url=String(output).match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];assert.ok(url);
  const res=await fetch(url);assert.equal(res.status,200);assert.match(await res.text(),/NEXUS/);assert.match(res.headers.get('content-security-policy'),/connect-src 'self'/);
  const snapshot=await fetch(url+'api/schedule');assert.equal(snapshot.status,200);assert.equal((await snapshot.json()).schemaVersion,3);
  for(const route of ['api/predictions','api/evaluations','api/model-health']) {const response=await fetch(url+route);assert.equal(response.status,200);assert.equal((await response.json()).schemaVersion,1);}
  assert.equal((await fetch(url+'api/status')).status,200);
  for(const route of ['tests/model.test.mjs','design/overview-concept.png','.git/config','%2e%2e%5cindex.html','crawler.mjs','history.mjs','history-sync.mjs','health.mjs','data/schedule.json','data/prediction-history.json','.cache/crawl-status.json','api/schedule?url=https://example.com','api/evaluations?url=https://example.com','api/model-health?x=1','api/refresh'])assert.equal((await fetch(url+route)).status,404,route);
  for(const route of ['','api/schedule','api/status','api/predictions','api/evaluations','api/model-health'])assert.equal((await fetch(url+route,{method:'POST',body:'test'})).status,405);
  for(const route of ['api/schedule','api/predictions','api/evaluations','api/model-health']) {const head=await fetch(url+route,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');}
  assert.equal((await fetch(url+'app.mjs')).status,200);assert.equal((await fetch(url+'schedule.mjs')).status,200);
  for(const route of ['journal.mjs','journal-ui.mjs'])assert.equal((await fetch(url+route)).status,200);
  for(const route of ['api/journal','api/import','api/restore','nexus-worlds-v3.json'])assert.equal((await fetch(url+route)).status,404);
  assert.equal((await fetch(url+'api/journal',{method:'POST',body:'private draft'})).status,405);
 }finally{child.kill();await once(child,'exit');}
});
