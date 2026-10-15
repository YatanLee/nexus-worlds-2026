import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('loopback server serves app with CSP and rejects paths and writes',{timeout:10000},async()=>{
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  try {
    // PORT=0 delegates an available port to the OS; server prints its actual bound port.
    const [output]=await once(child.stdout,'data');
    const url=String(output).match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
    assert.ok(url);
    const res=await fetch(url);
    assert.equal(res.status,200);assert.ok((await res.text()).includes('NEXUS'));
    assert.match(res.headers.get('content-security-policy'),/connect-src 'none'/);
    assert.equal((await fetch(url+'app.mjs')).status,200);
    assert.equal((await fetch(url+'tests/model.test.mjs')).status,404);
    assert.equal((await fetch(url+'design/overview-concept.png')).status,404);
    assert.equal((await fetch(url+'.git/config')).status,404);
    assert.equal((await fetch(url+'%2e%2e%5cindex.html')).status,404);
    assert.equal((await fetch(url,{method:'POST',body:'test'})).status,405);
    assert.equal((await fetch(url,{method:'HEAD'})).status,200);
  } finally {child.kill();await once(child,'exit');}
});
