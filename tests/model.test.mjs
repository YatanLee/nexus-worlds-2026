import test from 'node:test';
import assert from 'node:assert/strict';
import {seriesOutcomes,markets,mapProbability,implied,validateMatch} from '../model.mjs';
import {FIXTURES} from '../data.mjs';

test('terminal series distribution conserves probability with only valid scores',()=>{
  for(const bo of [1,3,5]) for(const p of [0,.1,.5,.72,1]) {
    const rows=seriesOutcomes(p,bo), target=(bo+1)/2;
    assert.ok(Math.abs(rows.reduce((s,o)=>s+o.p,0)-1)<1e-12);
    assert.ok(rows.every(o=>(o.a===target && o.b<target)||(o.b===target && o.a<target)));
    const win=rows.filter(o=>o.a>o.b).reduce((s,o)=>s+o.p,0);
    if(p===.5) assert.ok(Math.abs(win-.5)<1e-12);
    if(p===0 || p===1) assert.equal(win,p);
  }
});
test('BO5 fair total and handicap settle from complete terminal scores',()=>{
  const m=markets(FIXTURES[0],[50,50,50,50,50]);
  assert.equal(m.list.find(x=>x.key==='total').options[0].p,.75);
  assert.equal(m.list.find(x=>x.key==='handicap').options[0].p,.3125);
  assert.ok(m.list.filter(x=>!x.unavailable).every(x=>Math.abs(x.options.reduce((s,o)=>s+o.p,0)-1)<1e-12));
});
test('BO3 and BO5 alternate total-line settlement is exact',()=>{
  const bo3=markets({...FIXTURES[0],bestOf:3},[50,50,50,50,50]);
  assert.equal(bo3.list.find(x=>x.key==='total').options[0].p,.5);
  assert.equal(bo3.list.find(x=>x.key==='handicap').options[0].p,.25);
  const bo5=markets(FIXTURES[0],[50,50,50,50,50],'balanced',4.5);
  assert.equal(bo5.list.find(x=>x.key==='total').options[0].p,.375);
});
test('BO1 excludes impossible spread, total, and score markets; objectives have no fabricated probability',()=>{
  const m=markets({...FIXTURES[0],bestOf:1});
  assert.ok(!m.list.some(x=>['handicap','total','score'].includes(x.key)));
  assert.ok(m.list.filter(x=>x.unavailable).every(x=>x.options.every(o=>o.p===null)));
});
test('no-vig probabilities sum to one, invalid odds rejected',()=>{
  const m=implied([1.72,2.08]);
  assert.ok(Math.abs(m.normalized.reduce((a,b)=>a+b,0)-1)<1e-12);
  for(const o of [[1,2],[0,2],[NaN,2],[Infinity,2],[1001,2]]) assert.equal(implied(o),null);
});
test('rating direction is monotone; neutral is symmetric',()=>{
  assert.equal(mapProbability([50,50,50,50,50]),.5);
  assert.ok(mapProbability([75,75,75,75,75])>mapProbability([60,60,60,60,60]));
});
test('import validation rejects malformed inputs and bounds strings',()=>{
  assert.equal(validateMatch({...FIXTURES[0],bestOf:7}),null);
  assert.equal(validateMatch({...FIXTURES[0],scores:[1,2]}),null);
  assert.equal(validateMatch({...FIXTURES[0],odds:[1,2]}),null);
  const clean=validateMatch({...FIXTURES[0],secret:'not retained',a:'x'.repeat(200)});
  assert.equal(clean.a.length,60); assert.ok(!('secret' in clean));
});
