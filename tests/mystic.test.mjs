import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mysticAssessment} from '../mystic.mjs';
import {MYSTIC_CASES} from '../mystic-data.mjs';
import {forecast,MODEL_VERSION} from '../model.mjs';
const snapshot=JSON.parse(await readFile(new URL('../data/schedule.json',import.meta.url),'utf8'));
const now=Date.parse('2026-10-17T10:00:00Z');
const m={id:'115660588583171798',state:'scheduled',bestOf:5,startTime:'2026-10-17T18:00:00Z',observedAt:'2026-10-17T01:19:08Z',teams:[{id:'107251245690956393',code:'MVK',region:'PAC'},{id:'100205576309502431',code:'FUR',region:'BR'}]};
const result=(id,teams,startTime='2026-10-16T01:00:00Z',observedAt='2026-10-17T01:19:08Z')=>({id,state:'completed',bestOf:5,startTime,observedAt,teams});
const rematch=result('prior',[{...m.teams[1],wins:0},{...m.teams[0],wins:3}]);
const c9={id:'98767991877340524',code:'C9',region:'NA'};
const kc={id:'111692118851466302',code:'KC',region:'EMEA'};
const mvkLoss=result('mvk-loss',[{...m.teams[0],wins:0},{...kc,wins:3}],'2026-10-16T18:00:00Z');
const furWin=result('fur-win',[{...c9,wins:1},{...m.teams[1],wins:3}],'2026-10-16T23:00:00Z');
const rows=[rematch,mvkLoss,furWin];

test('reviewed catalog contains bounded sourced history without mystical probabilities',()=>{
 assert.equal(new Set(MYSTIC_CASES.map(c=>c.id)).size,MYSTIC_CASES.length);
 for(const card of MYSTIC_CASES){
  for(const field of ['title','fact','interpretation','limitation'])assert.ok(typeof card[field]==='string'&&card[field].length>5&&card[field].length<250);
  assert.ok(Number.isInteger(card.year)&&card.year>=2012&&card.year<=2024);
  const url=new URL(card.source.url);assert.equal(url.protocol,'https:');assert.ok(['lolesports.com','na.leagueoflegends.com','www.leagueoflegends.com','ge.globo.com'].includes(url.hostname));assert.equal(url.username,'');assert.equal(url.password,'');
  assert.equal(card.source.checkedAt,'2026-10-17');assert.ok(card.source.title&&card.source.publisher&&card.source.type);
  assert.ok(!Object.keys(card).some(k=>/odds|probability|elo|private/i.test(k)));
 }
 assert.match(MYSTIC_CASES.find(c=>c.id==='kabum-2014').source.type,/次級/);
 assert.match(MYSTIC_CASES.find(c=>c.id==='gen-2024-msi').limitation,/不同賽事/);
});

test('team identity is exact and PAC never inherits Taiwan or Vietnam history',()=>{
 const assessment=mysticAssessment(m,rows,{win:.535},'legacy',now);
 assert.deepEqual(assessment.missingTeams,['MVK','FUR']);assert.equal(assessment.team.length,0);
 assert.deepEqual(assessment.region.map(c=>c.id),['kabum-2014']);assert.match(assessment.region[0].scopeLabel,/非本隊/);
 assert.ok(assessment.worlds.some(c=>c.id==='tpa-2012'));assert.match(assessment.worlds.find(c=>c.id==='tpa-2012').limitation,/不能套用/);
 const c9Match={...m,teams:[c9,kc]};
 const direct=mysticAssessment(c9Match,[],{win:.3},'legacy',now);
 assert.deepEqual(direct.team.map(c=>c.id),['c9-2018']);assert.match(direct.team[0].scopeLabel,/舊陣容/);
 assert.deepEqual(direct.region.map(c=>c.id),['g2-2018']);assert.equal(direct.score.side,0);
 const fakeCode=mysticAssessment({...m,teams:[{...c9,id:'11111111111111111'},m.teams[1]]},[],{win:.3},'legacy',now);
 assert.equal(fakeCode.team.length,0);assert.equal(fakeCode.score,null);
});

test('rematch and recent results use team IDs even when official sides swap',()=>{
 const original=JSON.stringify([m,rows]);
 const legacy=mysticAssessment(m,rows,{win:.535},'legacy',now);
 assert.deepEqual(legacy.score,{side:0,a:3,b:2});assert.match(legacy.scoreReason,/前次交手/);
 assert.equal(legacy.recent.length,3);assert.match(legacy.recent[0].fact,/FUR vs MVK 0：3/);
 const momentum=mysticAssessment(m,rows,{win:.535},'momentum',now);
 assert.deepEqual(momentum.score,{side:1,a:2,b:3});
 const swapped=mysticAssessment({...m,teams:[...m.teams].reverse()},rows,{win:.465},'momentum',now);
 assert.equal(swapped.score.side,0);assert.equal(swapped.score.a,3);
 assert.equal(JSON.stringify([m,rows]),original);
});

test('future observations, this fixture, malformed results and post-start corrections never inform a pregame story',()=>{
 const bad=[{...rematch,id:m.id},{...rematch,observedAt:m.startTime},{...rematch,observedAt:'2026-10-18T01:00:00Z'},{...rematch,startTime:'2026-10-18T01:00:00Z'},
  {...rematch,teams:rematch.teams.map(t=>({...t,wins:3}))},{...rematch,teams:rematch.teams.map(t=>({...t,wins:0}))},
  {...rematch,state:'live'},{...rematch,startTime:'2025-10-01T00:00:00Z'},{...rematch,observedAt:null},
  {...rematch,observedAt:'2026-10-17T10:00:00Z'},{...rematch,observedAt:'2026-10-15T01:00:00Z'}];
 const a=mysticAssessment(m,bad,{win:.535},'momentum',now);
 assert.equal(a.recent.length,0);assert.equal(a.score,null);
 const completed=mysticAssessment({...m,state:'completed'},[...rows,{...rematch,observedAt:'2026-10-18T00:00:00Z'}],{win:.535},'legacy',Date.parse('2026-10-18T01:00:00Z'));
 assert.equal(completed.score,null);assert.equal(completed.pregame,false);assert.equal(completed.recent.length,3);
});

test('no fabricated scores for unavailable, ambiguous or empty evidence',()=>{
 for(const unavailable of [{...m,state:'live'},{...m,state:'completed'},{...m,teams:[m.teams[0],{id:'0',code:'TBD'}]},{...m,observedAt:'2026-10-14T00:00:00Z'},{...m,startTime:new Date(now).toISOString()}]){
  assert.equal(mysticAssessment(unavailable,rows,{win:.535},'underdog',now).score,null);
 }
 assert.equal(mysticAssessment(m,rows,null,'underdog',now).score,null);
 assert.equal(mysticAssessment(m,rows,{win:.5},'underdog',now).score,null);
 assert.equal(mysticAssessment(m,[],{win:.6},'legacy',now).score,null);
 assert.equal(mysticAssessment(m,[],{win:.6},'momentum',now).score,null);
 assert.equal(mysticAssessment(m,[furWin],{win:.6},'momentum',now).score,null);
 const bothWin=[{...furWin},result('mvk-win',[{...m.teams[0],wins:3},{...kc,wins:0}],'2026-10-16T18:00:00Z')];
 assert.equal(mysticAssessment(m,bothWin,{win:.6},'momentum',now).score,null);
 assert.equal(mysticAssessment(null,[],null,'invalid',now).theme,'underdog');
});

test('themes remain compatible, produce legal scores, and cannot mutate the professional model or history',async()=>{
 const publicBefore=await readFile(new URL('../data/prediction-history.json',import.meta.url),'utf8');
 const f=forecast({...m,observedAt:snapshot.fetchedAt},snapshot.ratings,0,now),before=JSON.stringify(f);assert.ok(f);
 for(const bestOf of [1,3,5])for(const theme of ['underdog','legacy','momentum']){
  const a=mysticAssessment({...m,bestOf},rows,f,theme,now);assert.ok(a.score);
  assert.equal(Math.max(a.score.a,a.score.b),(bestOf+1)/2);assert.equal(Math.min(a.score.a,a.score.b),(bestOf-1)/2);
  assert.ok(!('p' in a.score)&&!('win' in a.score));assert.equal(JSON.stringify(f),before);
 }
 assert.equal(MODEL_VERSION,'elo-exact-score-v1');
 assert.equal(await readFile(new URL('../data/prediction-history.json',import.meta.url),'utf8'),publicBefore);
});
