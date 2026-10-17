import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyJournal,entryState,exportBackup,fixtureRef,importBackup,migrateLegacy,setPregame,setReflection,validateJournal} from '../journal.mjs';

const future='2026-10-20T12:00:00Z', before=new Date('2026-10-20T11:00:00Z'), atStart=new Date(future), after=new Date('2026-10-20T13:00:00Z');
const match={id:'10000000001',startTime:future,bestOf:3,state:'scheduled',teams:[{id:'20000000002'},{id:'20000000001'}]};
const score=[{id:'20000000001',wins:2},{id:'20000000002',wins:1}];
test('stores legal canonical scores immutably and locks exactly at start',()=>{
 const original=emptyJournal(),saved=setPregame(original,match,{predictedScore:score,reason:'draft edge',keyPlayerObservation:'watch jungle',mysticChoice:'legacy'},before);
 assert.equal(original.entries['10000000001'],undefined);assert.deepEqual(saved.entries['10000000001'].fixture,fixtureRef(match));assert.deepEqual(saved.entries['10000000001'].predictedScore,score);
 assert.equal(entryState(saved.entries[match.id],match,before),'open');assert.equal(entryState(saved.entries[match.id],match,atStart),'locked');
 assert.throws(()=>setPregame(saved,match,{reason:'too late'},atStart));
 assert.throws(()=>setPregame(emptyJournal(),{...match,teams:[{id:'0'},{id:'20000000001'}]},{predictedScore:score},before));
 assert.throws(()=>setPregame(emptyJournal(),match,{predictedScore:[...score].reverse()},before));
});
test('preserves canonical identity and classifies changed or unknown fixtures as detached',()=>{
 const store=setPregame(emptyJournal(),match,{predictedScore:score},before);
 const changed={...match,startTime:'2026-10-20T12:30:00Z'};
 assert.equal(entryState(store.entries[match.id],changed,before),'detached');
 assert.throws(()=>setPregame(store,changed,{reason:'reassign'},before));
 assert.equal(entryState(store.entries[match.id],null,before),'detached');
});

test('locks millisecond start times without Date string precision loss',()=>{
 const precise={...match,startTime:'2026-10-20T12:00:00.500Z'};
 const saved=setPregame(emptyJournal(),precise,{predictedScore:score},before);
 const deadline=new Date(precise.startTime);
 assert.equal(entryState(saved.entries[match.id],precise,new Date(+deadline-1)),'open');
 assert.equal(entryState(saved.entries[match.id],precise,deadline),'locked');
 assert.equal(entryState(saved.entries[match.id],precise,+deadline+1),'locked');
 assert.throws(()=>setPregame(saved,precise,{reason:'late'},deadline));
 assert.throws(()=>setPregame(saved,precise,{reason:'invalid'},new Date(NaN)));
});
test('keeps reflection separate and editable only after the fixture begins',()=>{
 const store=setPregame(emptyJournal(),match,{reason:'before'},before);
 assert.throws(()=>setReflection(store,match.id,'not yet',[match],before));
 const reflected=setReflection(store,match.id,'review after the series',[match],after);
 assert.equal(reflected.entries[match.id].reason,'before');assert.equal(reflected.entries[match.id].reflection,'review after the series');
});
test('creates a reflection-only entry only for a confirmed fixture after it starts',()=>{
 const completed={...match,state:'completed',teams:[{id:'20000000002'},{id:'20000000001'}]};
 const reflected=setReflection(emptyJournal(),match.id,'reflection only',[completed],after);
 assert.equal(reflected.entries[match.id].predictedScore,null);assert.equal(reflected.entries[match.id].predictedAt,null);assert.equal(reflected.entries[match.id].reflection,'reflection only');
 assert.throws(()=>setReflection(emptyJournal(),match.id,'early',[match],before));
 const tbd={...match,teams:[{id:'0'},{id:'20000000001'}],state:'completed'};
 assert.throws(()=>setReflection(emptyJournal(),match.id,'unknown',[tbd],after));
});
test('exports, reloads, and imports a legitimate earlier prediction after start',()=>{
 const store=setPregame(emptyJournal(),match,{predictedScore:score,mysticChoice:'momentum'},before);
 const backup=exportBackup(store,before),restored=importBackup(emptyJournal(),backup,[match],after);
 assert.deepEqual(restored.entries[match.id].predictedScore,score);assert.equal(restored.settings.theme,'underdog');
});
test('migrates private v2 references and settings without creating official fixtures',()=>{
 const legacy={version:2,saved:[match.id,'10000000099'],notes:{[match.id]:'keep','10000000099':'archived note'},theme:'legacy',adjustments:{[match.id]:25,'10000000099':9}};
 const result=migrateLegacy(legacy,[match]);
 assert.deepEqual(result.saved,[match.id,'10000000099']);assert.deepEqual(result.notes,legacy.notes);assert.equal(result.settings.theme,'legacy');assert.deepEqual(result.settings.adjustments,legacy.adjustments);assert.deepEqual(result.entries,{});
});
test('preserves legacy TBD and no-longer-listed private references without creating fixtures',()=>{
 const tbd={id:'10000000002',startTime:future,bestOf:3,state:'scheduled',teams:[{id:'0'},{id:'20000000001'}]};
 const result=migrateLegacy({version:2,saved:[tbd.id,'10000000003'],notes:{[tbd.id]:'TBD note','10000000003':'archived'}},[tbd]);
 assert.deepEqual(result.saved,[tbd.id,'10000000003']);assert.deepEqual(result.notes,{[tbd.id]:'TBD note','10000000003':'archived'});assert.deepEqual(result.entries,{});
});
test('merges import atomically with current entries notes and settings winning, bookmarks unioned',()=>{
 const local=setPregame(emptyJournal(),match,{reason:'local'},before);local.notes[match.id]='local note';local.saved=[match.id];local.settings={theme:'legacy',adjustments:{[match.id]:10}};
 const incoming=setPregame(emptyJournal(),match,{reason:'incoming'},before);incoming.notes[match.id]='incoming note';incoming.saved=['10000000002'];incoming.settings={theme:'momentum',adjustments:{'10000000002':20}};
 const merged=importBackup(local,exportBackup(incoming,before),[match],before);
 assert.equal(merged.entries[match.id].reason,'local');assert.equal(merged.notes[match.id],'local note');assert.deepEqual(merged.saved,[match.id,'10000000002']);assert.deepEqual(merged.settings,{theme:'legacy',adjustments:{[match.id]:10,'10000000002':20}});
 const restored=importBackup(emptyJournal(),exportBackup(incoming,before),[match],before);assert.deepEqual(restored.settings,incoming.settings);
});
test('merges non-conflicting incoming adjustments while preserving local keys and theme',()=>{
 const local=emptyJournal();local.settings={theme:'legacy',adjustments:{[match.id]:10}};
 const incoming=emptyJournal();incoming.settings={theme:'momentum',adjustments:{[match.id]:20,'10000000002':25}};
 const merged=importBackup(local,exportBackup(incoming,before),[match],before);
 assert.equal(merged.settings.theme,'legacy');assert.deepEqual(merged.settings.adjustments,{[match.id]:10,'10000000002':25});
});
test('rejects malformed schema, post-start scores, caps, size and prototype-shaped inputs atomically',()=>{
 const store=emptyJournal(),backup=JSON.parse(exportBackup(store,before));
 backup.journal.entries[match.id]={fixture:fixtureRef(match),predictedScore:score,predictedAt:future,reason:'',keyPlayerObservation:'',mysticChoice:null,reflection:''};
 assert.throws(()=>importBackup(store,JSON.stringify(backup),[match],after));assert.deepEqual(store,emptyJournal());
 assert.throws(()=>importBackup(store,'x'.repeat(1024*1024+1),[match],before));
 assert.throws(()=>validateJournal({__proto__:null,...emptyJournal()}));
 const capped=emptyJournal();capped.saved=Array.from({length:101},(_,i)=>String(10000000000+i));assert.throws(()=>validateJournal(capped));
 const tooMany=emptyJournal();for(let i=0;i<201;i++){const id=String(10000000000+i);tooMany.entries[id]={fixture:{...fixtureRef(match),id},predictedScore:null,predictedAt:null,reason:'',keyPlayerObservation:'',mysticChoice:null,reflection:''};}assert.throws(()=>validateJournal(tooMany));
});
test('does not turn unknown imported IDs into official fixtures or routes',()=>{
 const detached=setPregame(emptyJournal(),match,{predictedScore:score},before);
 detached.entries[match.id].fixture.id='10000000009';
 assert.throws(()=>validateJournal(detached));
 const unknown=emptyJournal();unknown.entries['10000000009']={...emptyJournal()};
 // Build a structurally valid detached entry without supplying an official match.
 unknown.entries['10000000009']={fixture:{...fixtureRef(match),id:'10000000009'},predictedScore:null,predictedAt:null,reason:'archived',keyPlayerObservation:'',mysticChoice:null,reflection:''};
 const result=importBackup(emptyJournal(),exportBackup(unknown,before),[match],before);
 assert.ok(result.entries['10000000009']);assert.equal(entryState(result.entries['10000000009'],null,before),'detached');
});
