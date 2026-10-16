import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {parseSchedule,extractObjects,fetchOfficial,atomicJSON,refreshSchedule,readSnapshot,readStatus} from '../crawler.mjs';
import {SOURCE,TOURNAMENT,validateSnapshot} from '../schedule.mjs';
const raw=(id='115660588583171786')=>({__typename:'EventMatch',id,blockName:'Play-Ins',startTime:'2026-10-15T18:00:00Z',state:'unstarted',league:{slug:'worlds'},tournament:{name:'2026',id:TOURNAMENT},match:{strategy:{count:5}},matchTeams:[{teamId:'98767991877340524',code:'C9',name:'Cloud9 Kia',homeLeague:{regionSlug:'na'},result:{gameWins:0}},{teamId:'0',code:'TBD',name:'TBD',result:null}]});
const html=(event,hasMore=false)=>`<script>window.data=${JSON.stringify({__typename:'EsportsData',events:[event],pages:{older:null,newer:hasMore?'cursor':null}})}</script>`;
const now=new Date('2026-10-15T14:00:00Z');
const temp=async()=>{const dir=path.resolve('.cache',`test-${randomUUID()}`);await mkdir(dir,{recursive:true});return dir;};
test('crawler parses JSON only, deduplicates official current tournament, keeps TBD',()=>{
 const e=raw(),old={...raw('115660588583171787'),tournament:{id:'old',name:'2025'}};
 const s=parseSchedule(html(e)+html(e)+html(old),now);
 assert.equal(s.matches.length,1);assert.equal(s.matches[0].teams[1].code,'TBD');assert.equal(s.source,SOURCE);
 assert.equal(s.sourcePublishedAt,null);assert.equal(s.matches[0].startTime,e.startTime);
 assert.equal(extractObjects('<p>no data</p>','EventMatch').length,0);
 const reordered={id:e.id,note:'quoted { brace } and \\" text',match:e.match, __typename:e.__typename,...e};
 assert.equal(parseSchedule(html(reordered),now).matches[0].id,e.id);
 assert.throws(()=>parseSchedule('<script>{"__typename":"EventMatch","id":globalThis.danger=true}</script>',now),/not JSON/);
 assert.throws(()=>parseSchedule('{"__typename":"EventMatch"',now),/Truncated/);
 assert.throws(()=>parseSchedule(html(e)+html({...e,startTime:'2026-10-16T18:00:00Z'}),now),/Conflicting/);
});
test('malformed, other year, unknown stage, script strings and oversized input fail closed',()=>{
 for(const patch of [{startTime:'2025-10-15T18:00:00Z'},{startTime:'invalid'},{blockName:'Invented'}, {id:'injected'}, {matchTeams:[{teamId:'0',code:'<svg>',name:'TBD'}]}])assert.throws(()=>parseSchedule(html({...raw(),...patch}),now));
 assert.throws(()=>parseSchedule('x'.repeat(8*1024*1024+1),now),/limit/);
 assert.throws(()=>parseSchedule(html({...raw(),tournament:{id:TOURNAMENT,name:'2025'}}),now));
 const s=parseSchedule(html(raw()),now);s.matches.push(s.matches[0]);assert.throws(()=>validateSnapshot(s));
});
test('public fetch restricts redirects, content type, length and streaming size',async()=>{
 let calls=0;
 await assert.rejects(fetchOfficial(async()=>{calls++;return new Response('',{status:302,headers:{Location:'https://attacker.invalid/x'}});}),/redirect rejected/);assert.equal(calls,1);
 await assert.rejects(fetchOfficial(async()=>new Response('x',{headers:{'Content-Type':'application/json'}})),/unavailable/);
 await assert.rejects(fetchOfficial(async()=>new Response('x',{headers:{'Content-Type':'text/html','Content-Length':String(9*1024*1024)}})),/limit/);
 await assert.rejects(fetchOfficial(async()=>new Response('x'.repeat(8*1024*1024+1),{headers:{'Content-Type':'text/html'}})),/limit/);
 let signal;assert.equal(await fetchOfficial(async(url,options)=>{assert.equal(url,SOURCE);assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');signal=options.signal;return new Response('<html>ok</html>',{headers:{'Content-Type':'text/html'}});}),'<html>ok</html>');assert.ok(signal instanceof AbortSignal);
});
test('daily suppression, failed refresh and persistence preserve last good schedule',async()=>{
 const root=await temp();let calls=0;
 const fetcher=async()=>{calls++;return html(raw());};
 assert.equal((await refreshSchedule({root,now,fetcher})).ok,true);
 const original=await readFile(path.join(root,'data/schedule.json'),'utf8');
 assert.equal((await refreshSchedule({root,now,fetcher})).skipped,true);assert.equal(calls,1);
 const nextDay=new Date('2026-10-16T14:00:00Z');
 assert.equal((await refreshSchedule({root,now:nextDay,fetcher:async()=>{throw new Error('do not expose raw upstream error');}})).ok,false);
 assert.equal(await readFile(path.join(root,'data/schedule.json'),'utf8'),original);
 assert.equal((await readStatus(root)).ok,false);
 assert.ok(!(JSON.stringify(await readStatus(root))).includes('upstream'));
 assert.equal((await refreshSchedule({root,now:nextDay,fetcher})).skipped,true);assert.equal(calls,1);
 assert.equal((await refreshSchedule({root,now:nextDay,force:true,fetcher})).ok,true);
});
test('later official pages preserve previously seen real fixtures without guessing missing matches',async()=>{
 const root=await temp();
 await refreshSchedule({root,now,fetcher:async()=>html(raw())});
 await refreshSchedule({root,now:new Date('2026-10-16T14:00:00Z'),fetcher:async()=>html(raw('115660588583171787'),true)});
 assert.equal((await readSnapshot(root)).matches.length,2);
 const retained=(await readSnapshot(root)).matches.find(m=>m.id==='115660588583171786');assert.equal(retained.observedAt,now.toISOString().replace('.000Z','Z'));
 await refreshSchedule({root,now:new Date('2026-10-17T14:00:00Z'),fetcher:async()=>html(raw('115660588583171787'))});
 assert.equal((await readSnapshot(root)).matches.length,1);
});
test('result validation enforces BO target and state consistency',()=>{
 for(const [bo,a,b,state]of [[1,3,0,'completed'],[3,3,0,'completed'],[3,1,1,'completed'],[3,2,2,'completed'],[5,1,0,'unstarted'],[5,null,1,'completed']]){
  const e=raw();e.state=state;e.match.strategy.count=bo;e.matchTeams=e.matchTeams.map((t,i)=>({...t,teamId:i?'111692118851466302':t.teamId,code:i?'KC':t.code,name:i?'Karmine Corp':t.name,result:{gameWins:i?b:a}}));assert.throws(()=>parseSchedule(html(e),now));
 }
 const e=raw();e.state='completed';e.matchTeams[1]={...e.matchTeams[0],teamId:'111692118851466302',code:'KC',name:'Karmine Corp',result:{gameWins:3}};e.matchTeams[0].result.gameWins=2;
 assert.equal(parseSchedule(html(e),now).matches[0].teams[1].wins,3);
});
test('atomic write failure does not damage the existing destination',async()=>{
 const root=await temp(),file=path.join(root,'snapshot.json');await atomicJSON(file,{good:true});
 const circular={};circular.self=circular;
 await assert.rejects(atomicJSON(file,circular));assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{good:true});
 // An unavailable destination also fails without touching any successful snapshot.
 await mkdir(path.join(root,'blocked.json'));await assert.rejects(atomicJSON(path.join(root,'blocked.json'),{new:true}));
 assert.deepEqual(JSON.parse(await readFile(file,'utf8')),{good:true});
});
