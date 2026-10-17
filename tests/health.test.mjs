import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateHealth,modelHealth} from '../health.mjs';
import {buildHistory,emptyHistory} from '../history.mjs';

const forecast=(p=.6,top=[{a:2,b:1,p:.3}],outcomes=[{a:2,b:1,p:.3},{a:1,b:2,p:.7}])=>({p,win:p,top,outcomes});
const row=(overrides={})=>({modelVersion:'model-a',bestOf:3,startTime:'2026-10-17T12:00:00Z',status:'verified',reason:null,actual:{a:2,b:1},completed:true,forecast:forecast(),...overrides});
const pick=(groups,model='model-a',bestOf='all')=>groups.find(group=>group.modelVersion===model&&group.bestOf===bestOf);

test('creates all and BO groups with suppressed small-sample measures',()=>{
 const all=aggregateHealth([row(),row({bestOf:1,actual:{a:1,b:0}})],['model-a']);
 const overall=pick(all), bo1=pick(all,'model-a',1), bo5=pick(all,'model-a',5);
 assert.equal(overall.counts.official,2);assert.equal(overall.exact.denominator,2);assert.equal(overall.exact.rate,null);
 assert.equal(overall.probability.brier,null);assert.equal(overall.probability.logLoss,null);
 assert.equal(bo1.period.from,'2026-10-17T12:00:00Z');assert.equal(bo5.counts.official,0);
});
test('orders same-second coverage boundaries by time rather than ISO text shape',()=>{
 const result=pick(aggregateHealth([
  row({startTime:'2026-10-17T12:00:00.123Z'}),
  row({startTime:'2026-10-17T12:00:00.000Z'})
 ]));
 assert.deepEqual(result.period,{from:'2026-10-17T12:00:00Z',to:'2026-10-17T12:00:00.123Z'});
});
test('shows measures only at twenty observations, per model and group',()=>{
 const nineteen=Array.from({length:19},()=>row());
 const twenty=Array.from({length:20},()=>row());
 assert.equal(pick(aggregateHealth(nineteen)).exact.rate,null);
 const result=pick(aggregateHealth(twenty));
 assert.equal(result.exact.rate,1);assert.equal(result.direction.rate,1);
 assert.ok(Math.abs(result.probability.brier-.16)<1e-12);assert.ok(result.probability.logLoss>0);assert.equal(result.probability.infinite,false);
 const split=aggregateHealth([...nineteen,row({modelVersion:'model-b'})]);
 assert.equal(pick(split,'model-b').probability.brier,null);
});
test('keeps score, direction, probability, and BO denominators independent in one cohort',()=>{
 const bo3=Array.from({length:19},()=>row());
 const tiedBo1=row({
  bestOf:1,
  actual:{a:1,b:0},
  forecast:forecast(.5,[{a:1,b:0,p:.5},{a:0,b:1,p:.5}],[{a:1,b:0,p:.5},{a:0,b:1,p:.5}])
 });
 const groups=aggregateHealth([...bo3,tiedBo1]);
 const overall=pick(groups), bo1=pick(groups,'model-a',1), bo3Group=pick(groups,'model-a',3);
 assert.equal(overall.probability.denominator,20);assert.notEqual(overall.probability.brier,null);assert.notEqual(overall.probability.logLoss,null);
 assert.equal(overall.exact.denominator,19);assert.equal(overall.exact.tiedTopExcluded,1);assert.equal(overall.exact.rate,null);
 assert.equal(overall.direction.denominator,19);assert.equal(overall.direction.evenExcluded,1);assert.equal(overall.direction.rate,null);
 assert.equal(bo1.probability.denominator,1);assert.equal(bo1.probability.brier,null);
 assert.equal(bo3Group.probability.denominator,19);assert.equal(bo3Group.probability.logLoss,null);
});
test('excludes tied tops and even winner calls only from their matching accuracies',()=>{
 const tied=row({forecast:forecast(.6,[{a:2,b:1,p:.3},{a:1,b:2,p:.3}])});
 const even=row({forecast:forecast(.5)});
 const result=pick(aggregateHealth([tied,even]));
 assert.equal(result.exact.tiedTopExcluded,1);assert.equal(result.exact.denominator,1);
 assert.equal(result.direction.evenExcluded,1);assert.equal(result.direction.denominator,1);
 assert.equal(result.probability.denominator,2);
});
test('surfaces impossible exact outcomes at publication threshold without clamping',()=>{
 const impossible=row({forecast:forecast(.6,[{a:2,b:1,p:0}],[{a:2,b:1,p:0},{a:1,b:2,p:1}])});
 const under=pick(aggregateHealth(Array.from({length:19},()=>impossible)));
 assert.equal(under.probability.infinite,false);assert.equal(under.probability.logLoss,null);
 const threshold=pick(aggregateHealth(Array.from({length:20},()=>impossible)));
 assert.equal(threshold.probability.infinite,true);assert.equal(threshold.probability.logLoss,null);assert.ok(Math.abs(threshold.probability.brier-.16)<1e-12);
});
test('counts no-baseline completed fixtures and reasons without promoting either to metrics',()=>{
 const result=pick(aggregateHealth([
  row({status:'no-baseline',forecast:null,actual:null,completed:true}),
  row({status:'unverified',reason:'fixture-changed',forecast:null,actual:null}),
  row({status:'pending',forecast:null,actual:null})
 ]));
 assert.deepEqual(result.counts,{official:3,verified:0,pending:1,unverified:1,noBaseline:1,completedNoBaseline:1});
 assert.deepEqual(result.reasons,{'fixture-changed':1});assert.equal(result.probability.denominator,0);
});
const sourceHash='a'.repeat(64);
const provenance={runId:'12345',attempt:1,codeCommit:'c'.repeat(40)};
function snapshot({state='scheduled',wins=[0,0],observedAt='2026-10-17T09:00:00Z'}={}) {
 return {tournament:'115660540725177488',fetchedAt:observedAt,sourceHash,coverage:{hasMore:false},matches:[{id:'10000000001',startTime:'2026-10-17T12:00:00Z',observedAt,state,bestOf:3,teams:[{id:'20000000001',code:'AAA',wins:wins[0]},{id:'20000000002',code:'BBB',wins:wins[1]}]}],ratings:[{id:'20000000001',elo:1400,calculatedAt:'2026-10-17T08:00:00Z',observedAt,sourceHash},{id:'20000000002',elo:1440,calculatedAt:'2026-10-17T08:00:00Z',observedAt,sourceHash}]};
}
test('model health uses the latest correction once and reports current official coverage',()=>{
 const baseline=buildHistory(emptyHistory(),snapshot(),provenance,new Date('2026-10-17T10:00:00Z'));
 const first=buildHistory(baseline,snapshot({state:'completed',wins:[2,1],observedAt:'2026-10-17T13:00:00Z'}),{...provenance,runId:'12346'},new Date('2026-10-17T13:00:00Z'));
 const corrected=buildHistory(first,snapshot({state:'completed',wins:[1,2],observedAt:'2026-10-17T14:00:00Z'}),{...provenance,runId:'12347'},new Date('2026-10-17T14:00:00Z'));
 const output=modelHealth(corrected,snapshot({state:'completed',wins:[1,2],observedAt:'2026-10-17T14:00:00Z'}),new Date('2026-10-17T15:00:00Z'));
 const result=pick(output.groups,'elo-exact-score-v1');
 assert.equal(output.schemaVersion,1);assert.equal(output.generatedAt,'2026-10-17T15:00:00Z');
 assert.equal(result.counts.official,1);assert.equal(result.counts.verified,1);assert.equal(result.probability.denominator,1);
 assert.equal(result.period.from,'2026-10-17T12:00:00Z');
});
test('model health exposes empty current-model groups with no history',()=>{
 const output=modelHealth(emptyHistory(),snapshot(),new Date('2026-10-17T10:00:00Z'));
 assert.equal(output.groups.length,4);assert.equal(pick(output.groups,'elo-exact-score-v1').counts.official,1);
 assert.equal(pick(output.groups,'elo-exact-score-v1',3).counts.noBaseline,1);
});
test('model health retains official TBD fixtures in coverage without inventing a prediction',()=>{
 const incomplete=snapshot();
 incomplete.matches.push({id:'10000000003',startTime:'2026-10-18T12:00:00Z',observedAt:'2026-10-17T09:00:00Z',state:'scheduled',bestOf:5,teams:[{id:'0',code:'TBD',wins:0},{id:'20000000002',code:'BBB',wins:0}]});
 const result=pick(modelHealth(emptyHistory(),incomplete).groups,'elo-exact-score-v1');
 assert.equal(result.counts.official,2);assert.equal(result.counts.noBaseline,2);
 assert.equal(pick(modelHealth(emptyHistory(),incomplete).groups,'elo-exact-score-v1',5).counts.official,1);
});
