import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MODEL_VERSION,baselineForecast,forecast,seriesOutcomes,mysticForecast} from '../model.mjs';
import {predictionAvailability,validateSnapshot,dailyWindow,timeTW} from '../schedule.mjs';
const snapshot=validateSnapshot(JSON.parse(await readFile(new URL('../data/schedule.json',import.meta.url),'utf8')));
const m={id:'115660588583171786',startTime:'2026-10-15T18:00:00Z',observedAt:'2026-10-15T14:00:00Z',stage:'playin',round:'Play-Ins',bestOf:5,state:'scheduled',teams:[{id:'98767991877340524',code:'C9',name:'Cloud9 Kia',region:'NA',wins:0},{id:'111692118851466302',code:'KC',name:'Karmine Corp',region:'EMEA',wins:0}]};
const now=Date.parse(m.startTime)-3600000;
const metadata={calculatedAt:'2026-10-15T12:00:00Z',observedAt:'2026-10-15T14:00:00Z',sourceHash:'a'.repeat(64)};
const baseRatings=[{id:m.teams[0].id,elo:1358,...metadata},{id:m.teams[1].id,elo:1403,...metadata}];
test('terminal distributions conserve probability and contain only legal scores',()=>{
 for(const bo of [1,3,5])for(const p of [0,.1,.5,.72,1]){
  const rows=seriesOutcomes(p,bo),target=(bo+1)/2;
  assert.ok(Math.abs(rows.reduce((s,o)=>s+o.p,0)-1)<1e-12);
  assert.equal(rows.length,2*target);
  assert.ok(rows.every(o=>(o.a===target&&o.b<target)||(o.b===target&&o.a<target)));
  const win=rows.filter(o=>o.a>o.b).reduce((s,o)=>s+o.p,0);
  if(p===.5)assert.ok(Math.abs(win-.5)<1e-12);
  if(p===0||p===1)assert.equal(win,p);
 }
 assert.throws(()=>seriesOutcomes(NaN,5));assert.throws(()=>seriesOutcomes(.5,7));
});
test('official Elo drives a symmetric, monotone score forecast',()=>{
 const ratings=m.teams.map(t=>({id:t.id,elo:1400,...metadata}));
 const f=forecast(m,ratings,0,now);
 assert.equal(f.p,.5);assert.equal(f.win,.5);assert.equal(f.top.length,4);
 assert.ok(forecast(m,ratings,50,now).win>f.win);
 assert.ok(forecast(m,ratings,-50,now).win<f.win);
 const unequal=[{...ratings[0],elo:1500},ratings[1]];
 assert.ok(forecast(m,unequal,0,now).win>.5);
 assert.equal(forecast(m,ratings,1000,now).adjustment,100);
 assert.equal(MODEL_VERSION,'elo-exact-score-v1');
 assert.deepEqual(baselineForecast(1400,1400,3),baselineForecast(1400,1400,3));
});
test('TBD, missing ratings, live, completed and elapsed slots do not produce pregame forecasts',()=>{
 const future={...m,startTime:new Date(now+3600000).toISOString().replace('.000Z','Z'),state:'scheduled'};
 assert.equal(predictionAvailability(future,now),'ready');
 assert.equal(forecast({...future,teams:[future.teams[0],{id:'0',code:'TBD'}]},baseRatings,0,now),null);
 assert.equal(forecast({...future,state:'live'},baseRatings,0,now),null);
 assert.equal(forecast({...future,state:'completed'},baseRatings,0,now),null);
 assert.equal(forecast(future,[],0,now),null);
 assert.equal(forecast(future,baseRatings,0,Date.parse(future.startTime)),null);
 assert.equal(forecast({...future,observedAt:'2026-10-13T14:00:00Z'},baseRatings,0,now),null);
 assert.equal(forecast(future,[{...baseRatings[0],observedAt:'2026-10-13T14:00:00Z'},baseRatings[1]],0,now),null);
 assert.equal(predictionAvailability(future,Date.parse(future.startTime)),'pending');
});
test('mystic themes never mutate professional probabilities and generate legal score scenarios',()=>{
 for(const bestOf of [1,3,5]){
  const match={...m,bestOf},f=forecast(match,baseRatings,0,now),before=JSON.stringify(f);
  for(const theme of ['underdog','legacy','momentum']){
   const mystic=mysticForecast(match,f,theme),target=(bestOf+1)/2;
   assert.equal(Math.max(mystic.a,mystic.b),target);assert.equal(Math.min(mystic.a,mystic.b),target-1);
   assert.equal(JSON.stringify(f),before);assert.ok(!('p' in mystic));
  }
 }
 assert.equal(mysticForecast(m,null),null);
});
test('daily update boundary and rendered times use Taiwan time',()=>{
 assert.equal(dailyWindow(new Date('2026-10-15T21:59:59Z')),'2026-10-15');
 assert.equal(dailyWindow(new Date('2026-10-15T22:00:00Z')),'2026-10-16');
 assert.match(timeTW('2026-10-15T18:00:00Z'),/10\/16.*02:00/);
});
test('production snapshot contains official IDs and no prediction or price inputs',()=>{
 assert.ok(snapshot.matches.every(x=>/^\d+$/.test(x.id)));
 assert.ok(!/"(?:odds|scores|custom)"/.test(JSON.stringify(snapshot)));
 const invalid=structuredClone(snapshot);invalid.matches[0].teams[0].code='<script>';
 assert.throws(()=>validateSnapshot(invalid));
});
