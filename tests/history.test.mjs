import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {assertAppendOnly,assertFreshPublication,buildHistory,emptyHistory,evaluationsView,selectLatestBaseline,validateHistory} from '../history.mjs';

const now='2026-10-17T10:00:00Z';
const sourceHash='a'.repeat(64), otherHash='b'.repeat(64);
const provenance={runId:'12345',attempt:1,codeCommit:'c'.repeat(40)};
const exec=promisify(execFile);
function snapshot({state='scheduled',startTime='2026-10-17T12:00:00Z',ids=['20000000001','20000000002'],wins=[0,0],bestOf=3,observedAt='2026-10-17T09:00:00Z',coverage=true}={}) {
  return {tournament:'115660540725177488',fetchedAt:observedAt,sourceHash,coverage:{hasMore:coverage},matches:[{id:'10000000001',startTime,observedAt,state,bestOf,teams:ids.map((id,i)=>({id,code:i?'BBB':'AAA',wins:wins[i]}))}],ratings:ids.map((id,i)=>({id,elo:1400+i*40,calculatedAt:'2026-10-17T08:00:00Z',observedAt,sourceHash}))};
}
test('builds a deterministic frozen pregame baseline and preserves exact reruns',()=>{
 const first=buildHistory(emptyHistory(),snapshot(),provenance,new Date(now));
 assert.equal(first.baselines.length,1); assert.equal(first.evaluations.length,0);
 assert.equal(first.baselines[0].teams[0].id,'20000000001');
 assert.deepEqual(buildHistory(first,snapshot(),provenance,new Date(now)),first);
 assert.equal(selectLatestBaseline(first,'10000000001').provenance.runId,'12345');
 const retrySource=snapshot();retrySource.ratings[0].elo=1600;
 const retry=buildHistory(first,retrySource,{...provenance,attempt:2},new Date('2026-10-17T10:30:00Z'));
 assert.deepEqual(retry,first);
});
test('does not backfill at the deadline and rejects stale or unobserved rating metadata',()=>{
 const atDeadline=buildHistory(emptyHistory(),snapshot(),provenance,new Date('2026-10-17T11:50:00Z'));
 assert.equal(atDeadline.baselines.length,0);
 const stale=snapshot({observedAt:'2026-10-16T06:00:00Z'});
 assert.equal(buildHistory(emptyHistory(),stale,provenance,new Date(now)).baselines.length,0);
 const legacy=snapshot(); legacy.ratings[0].observedAt=null;
 assert.equal(buildHistory(emptyHistory(),legacy,provenance,new Date(now)).baselines.length,0);
});
test('published records cannot change',()=>{
 const first=buildHistory(emptyHistory(),snapshot(),provenance,new Date(now));
 const altered=structuredClone(first); altered.baselines[0].forecast.p=.1;
 assert.throws(()=>validateHistory(altered));
 const alteredFingerprint=structuredClone(first); alteredFingerprint.baselines[0].fingerprint='f'.repeat(64);
 assert.throws(()=>validateHistory(alteredFingerprint),/fingerprint/);
 const shortened=structuredClone(first); shortened.baselines=[];
 assert.throws(()=>assertAppendOnly(first,shortened));
});
test('latest identity revision stays unverified until the current identity is recaptured',()=>{
 const first=buildHistory(emptyHistory(),snapshot(),provenance,new Date(now));
 const changedIds=['20000000001','20000000003'];
 const changed=buildHistory(first,snapshot({ids:changedIds}),{...provenance,runId:'12346'},new Date('2026-10-17T10:15:00Z'));
 const current=snapshot();
 const unverified=evaluationsView(changed,current).rows[0];
 assert.equal(unverified.status,'unverified');assert.equal(unverified.reason,'fixture-changed');assert.equal(unverified.revisionCount,2);
 const restored=buildHistory(changed,current,{...provenance,runId:'12347'},new Date('2026-10-17T10:30:00Z'));
 const pending=evaluationsView(restored,current).rows[0];
 assert.equal(pending.status,'pending');assert.equal(pending.revisionCount,3);
});
test('completed scores map by team IDs when official order reverses and corrections append',()=>{
 const base=buildHistory(emptyHistory(),snapshot(),provenance,new Date(now));
 const completed=snapshot({state:'completed',wins:[2,1],observedAt:'2026-10-17T13:00:00Z'});
 completed.matches[0].teams.reverse();
 const evaluated=buildHistory(base,completed,{...provenance,runId:'12346'},new Date('2026-10-17T13:00:00Z'));
 assert.equal(evaluated.evaluations.length,1);
 assert.deepEqual(evaluated.evaluations[0].actual,[{id:'20000000001',wins:2},{id:'20000000002',wins:1}]);
 const refetch=structuredClone(completed);refetch.fetchedAt='2026-10-17T14:00:00Z';
 assert.equal(buildHistory(evaluated,refetch,{...provenance,runId:'12347'},new Date('2026-10-17T14:00:00Z')).evaluations.length,1);
 const corrected=snapshot({state:'completed',wins:[1,2],observedAt:'2026-10-17T14:00:00Z'});
 const revised=buildHistory(evaluated,corrected,{...provenance,runId:'12348'},new Date('2026-10-17T14:00:00Z'));
 assert.equal(revised.evaluations.length,2);
 assert.equal(buildHistory(revised,corrected,{...provenance,runId:'12349'},new Date('2026-10-17T14:30:00Z')).evaluations.length,2);
 const restored=snapshot({state:'completed',wins:[2,1],observedAt:'2026-10-17T15:00:00Z'});
 const returned=buildHistory(revised,restored,{...provenance,runId:'12350'},new Date('2026-10-17T15:00:00Z'));
 assert.equal(returned.evaluations.length,3);
 assert.equal(returned.evaluations.at(-1).revision,3);
 assert.deepEqual(evaluationsView(returned,restored).rows[0].actual,{a:2,b:1});
});
test('fixture changes are never silently matched, and partial disappearance remains pending',()=>{
 const history=buildHistory(emptyHistory(),snapshot(),provenance,new Date(now));
 const shifted=snapshot({startTime:'2026-10-17T12:30:00Z'});
 const changed=evaluationsView(history,shifted).rows[0];
 assert.equal(changed.status,'unverified');assert.equal(changed.reason,'fixture-changed');
 const missing={tournament:'115660540725177488',fetchedAt:now,sourceHash,coverage:{hasMore:true},matches:[],ratings:[]};
 assert.equal(evaluationsView(history,missing).rows[0].status,'pending');
 missing.coverage.hasMore=false;
 assert.equal(evaluationsView(history,missing).rows[0].reason,'fixture-missing');
});
test('view marks tied tops and even win probability as non-directional',()=>{
 const equal=snapshot();equal.ratings[1].elo=1400;
 const history=buildHistory(emptyHistory(),equal,provenance,new Date(now));
 const complete=snapshot({state:'completed',wins:[2,1],observedAt:'2026-10-17T13:00:00Z'});complete.ratings[1].elo=1400;
 const done=buildHistory(history,complete,{...provenance,runId:'54321'},new Date('2026-10-17T13:00:00Z'));
 const row=evaluationsView(done,complete).rows[0];
 assert.equal(row.status,'verified');assert.equal(row.exactHit,null);assert.equal(row.winnerHit,null);assert.deepEqual(row.actual,{a:2,b:1});
});
test('view makes every official fixture visible when no public baseline exists',()=>{
 const result=evaluationsView(emptyHistory(),snapshot());
 assert.deepEqual(result.rows,[{matchId:'10000000001',modelVersion:'elo-exact-score-v1',baseline:null,status:'no-baseline',reason:'no-baseline',actual:null,exactHit:null,winnerHit:null,revisionCount:0}]);
});
test('history rejects private fields and caps, while publication guard catches delayed new rows',()=>{
 const history=buildHistory(emptyHistory(),snapshot(),provenance,new Date(now));
 const privateField=structuredClone(history);privateField.baselines[0].note='secret';
 assert.throws(()=>validateHistory(privateField));
 assert.throws(()=>assertFreshPublication(emptyHistory(),history,new Date('2026-10-17T11:50:00Z')));
 const big=emptyHistory();big.baselines=Array(5001).fill(history.baselines[0]);
 assert.throws(()=>validateHistory(big));
});
test('validation rejects future source observations and malformed completed results',()=>{
 const baseline=buildHistory(emptyHistory(),snapshot(),provenance,new Date(now));
 for (const mutate of [
  history=>{history.baselines[0].sourceFetchedAt='2026-10-17T10:01:00Z';},
  history=>{history.baselines[0].matchObservedAt='2026-10-17T10:01:00Z';},
  history=>{history.baselines[0].ratings[0].observedAt='2026-10-17T10:01:00Z';}
 ]) { const corrupt=structuredClone(baseline); mutate(corrupt); assert.throws(()=>validateHistory(corrupt)); }
 const complete=snapshot({state:'completed',wins:[2,1],observedAt:'2026-10-17T13:00:00Z'});
 const verified=buildHistory(baseline,complete,{...provenance,runId:'99999'},new Date('2026-10-17T13:00:00Z'));
 for (const mutate of [
  history=>{history.evaluations[0].actual[0].id='29999999999';},
  history=>{history.evaluations[0].actual[0].wins=3;},
  history=>{history.evaluations[0].actual[1].wins=2;},
  history=>{history.evaluations[0].capturedAt='2026-10-17T09:00:00Z';},
  history=>{history.evaluations[0].observedAt='2026-10-17T11:00:00Z';}
 ]) { const corrupt=structuredClone(verified); mutate(corrupt); assert.throws(()=>validateHistory(corrupt)); }
});
test('public history rejects stale or mismatched frozen provenance observations',()=>{
 const baseline=buildHistory(emptyHistory(),snapshot(),provenance,new Date(now));
 const stale='2026-10-16T07:59:59Z';
 for (const mutate of [
  history=>{history.baselines[0].sourceFetchedAt=stale;history.baselines[0].matchObservedAt=stale;},
  history=>{history.baselines[0].matchObservedAt='2026-10-17T08:59:59Z';},
  history=>{history.baselines[0].ratings[0].observedAt=stale;history.baselines[0].ratings[0].calculatedAt=stale;}
 ]) { const corrupt=structuredClone(baseline); mutate(corrupt); assert.throws(()=>validateHistory(corrupt)); }
});
test('local CLI rejects canonical history creation before it can write',async()=>{
 await assert.rejects(exec(process.execPath,['scripts/build-history.mjs'],{cwd:fileURLToPath(new URL('..',import.meta.url))}),error=>error.code===1&&/GitHub Actions/.test(error.stderr));
});
