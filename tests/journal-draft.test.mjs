import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {draftKey,fieldsFromEntry,quoteMysticEvidence} from '../journal-draft.mjs';
import {emptyJournal,exportBackup,importBackup,setPregame} from '../journal.mjs';
import {mysticAssessment} from '../mystic.mjs';
const now=Date.parse('2026-10-17T10:00:00Z');
const match={id:'115660588583171798',state:'scheduled',bestOf:5,startTime:'2026-10-17T18:00:00Z',observedAt:'2026-10-17T01:19:08Z',teams:[{id:'107251245690956393',code:'MVK',region:'PAC'},{id:'100205576309502431',code:'FUR',region:'BR'}]};
const assessment=mysticAssessment(match,[],null,'underdog',now);
const input={predictedScore:[...match.teams].sort((a,b)=>a.id.localeCompare(b.id)).map((team,index)=>({id:team.id,wins:index?1:3})),reason:'我的原始理由\n第二行',keyPlayerObservation:'先看前兩輪野區路線',mysticChoice:'legacy'};
const opts={match,assessment,evidenceKey:'region:kabum-2014',stance:'support',fields:input,now};
const hasCode=code=>error=>error.code===code;

test('evidence quote is a private draft that preserves all user fields and includes scope and source',()=>{
 const before=JSON.stringify([input,assessment,match]);
 const quoted=quoteMysticEvidence(opts);
 assert.ok(quoted.reason.startsWith(input.reason+'\n\n'));
 for(const text of ['玄學支持','KaBuM','2014','非本隊成績','不是 FURIA','查核 2026-10-17','https://ge.globo.com/'])assert.ok(quoted.reason.includes(text),text);
 assert.deepEqual(quoted.predictedScore,input.predictedScore);assert.equal(quoted.keyPlayerObservation,input.keyPlayerObservation);assert.equal(quoted.mysticChoice,input.mysticChoice);
 assert.equal(JSON.stringify([input,assessment,match]),before);
 quoted.predictedScore[0].wins=0;assert.equal(input.predictedScore[0].wins,3);
 const noScore=quoteMysticEvidence({...opts,fields:fieldsFromEntry()});assert.equal(noScore.predictedScore,null);assert.equal(noScore.mysticChoice,null);
});

test('duplicate support is refused, opposite stance is distinct and overlimit never truncates user text',()=>{
 const first=quoteMysticEvidence(opts);
 assert.throws(()=>quoteMysticEvidence({...opts,fields:first}),hasCode('duplicate'));
 const counter=quoteMysticEvidence({...opts,fields:first,stance:'counter'});assert.ok(counter.reason.includes('玄學反例'));assert.ok(counter.reason.includes('玄學支持'));
 const markerOnly=quoteMysticEvidence({...opts,fields:{...input,reason:''}}).reason;
 const exact={...input,reason:'x'.repeat(3000-markerOnly.length-2)};
 assert.equal(quoteMysticEvidence({...opts,fields:exact}).reason.length,3000);
 const over={...input,reason:'x'.repeat(3000-markerOnly.length-1)},before=JSON.stringify(over);
 assert.throws(()=>quoteMysticEvidence({...opts,fields:over}),hasCode('limit'));assert.equal(JSON.stringify(over),before);
});

test('locked, stale, unknown, detached and late source contexts cannot create a pregame quote',()=>{
 const entry=setPregame(emptyJournal(),match,input,now).entries[match.id];
 for(const unavailable of [{...match,state:'live'},{...match,state:'completed'},{...match,teams:[match.teams[0],{id:'0',code:'TBD'}]},
  {...match,observedAt:'2026-10-15T00:00:00Z'},{...match,observedAt:null},{...match,observedAt:'2026-10-17T11:00:00Z'}]){
  assert.throws(()=>quoteMysticEvidence({...opts,match:unavailable}),hasCode('unavailable'));
 }
 assert.throws(()=>quoteMysticEvidence({...opts,now:Date.parse(match.startTime)}),hasCode('unavailable'));
 assert.throws(()=>quoteMysticEvidence({...opts,entry,match:{...match,bestOf:3}}),hasCode('unavailable'));
 const boundary={...match,observedAt:new Date(now-26*3600000).toISOString()};assert.ok(quoteMysticEvidence({...opts,match:boundary}));
 assert.throws(()=>quoteMysticEvidence({...opts,match:{...boundary,observedAt:new Date(now-26*3600000-1).toISOString()}}),hasCode('unavailable'));
});

test('only a currently available evidence key and known stance can be quoted',()=>{
 for(const evidenceKey of ['worlds:gen-2024-msi','region:missing','__proto__:kabum-2014','region:__proto__','region:kabum-2014:extra','<script>'])assert.throws(()=>quoteMysticEvidence({...opts,evidenceKey}),hasCode('invalid'));
 assert.throws(()=>quoteMysticEvidence({...opts,stance:'certainty'}),hasCode('invalid'));
 assert.throws(()=>quoteMysticEvidence({...opts,fields:{...input,extra:'not a journal field'}}),hasCode('invalid'));
 assert.throws(()=>quoteMysticEvidence({...opts,assessment:{region:[]}}),hasCode('invalid'));
 const card=assessment.region[0];
 for(const url of ['javascript:alert(1)','https://lolesports.com.evil.example/','http://lolesports.com/','https://lolesports.com:444/'])assert.throws(()=>quoteMysticEvidence({...opts,assessment:{region:[{...card,source:{...card.source,url}}]}}),hasCode('invalid'));
 assert.throws(()=>quoteMysticEvidence({...opts,assessment:{region:[{...card,fact:'x'.repeat(1500)}]}}),hasCode('invalid'));
});

test('draft identity follows team IDs on sides swap and detaches when official identity changes',()=>{
 const swapped={...match,teams:[...match.teams].reverse()};assert.equal(draftKey(swapped),draftKey(match));
 for(const changed of [{...match,bestOf:3},{...match,startTime:'2026-10-18T18:00:00Z'},{...match,teams:[match.teams[0],{...match.teams[1],id:'11111111111111111'}]}])assert.notEqual(draftKey(changed),draftKey(match));
 const draft=quoteMysticEvidence(opts);assert.deepEqual(draft.predictedScore,input.predictedScore);
 const entry=setPregame(emptyJournal(),match,input,now).entries[match.id],fields=fieldsFromEntry(entry);fields.reason='edited in memory';assert.equal(entry.reason,input.reason);
});

test('explicit journal save and backup roundtrip preserve quotes without changing public data or schema',async()=>{
 const paths=['../data/schedule.json','../data/prediction-history.json'].map(path=>new URL(path,import.meta.url));
 const before=await Promise.all(paths.map(path=>readFile(path,'utf8'))),store=setPregame(emptyJournal(),match,input,now);
 const draft=quoteMysticEvidence({...opts,entry:store.entries[match.id]});assert.equal(store.entries[match.id].reason,input.reason);
 const saved=setPregame(store,match,draft,now+1);assert.equal(saved.version,3);assert.equal(saved.entries[match.id].reason,draft.reason);
 const restored=importBackup(emptyJournal(),exportBackup(saved,now+2),[match],now+3);
 assert.deepEqual(restored,saved);assert.deepEqual(await Promise.all(paths.map(path=>readFile(path,'utf8'))),before);
});
