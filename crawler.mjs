import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SOURCE,TOURNAMENT,normalizeEvent,validateSnapshot,dailyWindow} from './schedule.mjs';
export const ROOT=fileURLToPath(new URL('.',import.meta.url));
const MAX_BYTES=8*1024*1024;
export function extractObjects(html,type) {
  if (typeof html!=='string' || Buffer.byteLength(html)>MAX_BYTES) throw new Error('Source exceeds limit');
  const marker=new RegExp(`(?<!\\\\)"__typename"\\s*:\\s*"${type}"`,'g');
  const out=[];
  let match;
  while ((match=marker.exec(html))!==null) {
    if(out.length>=1000) throw new Error('Too many source objects');
    // Find the containing JSON object even when __typename is not its first key.
    let from=-1,backDepth=0,backQuote=false;
    for(let i=match.index-1;i>=Math.max(0,match.index-262144);i--) {
      const c=html[i];
      if(c==='"') {let slashes=0;for(let j=i-1;j>=0&&html[j]==='\\';j--)slashes++;if(slashes%2===0)backQuote=!backQuote;}
      else if(!backQuote && c==='}')backDepth++;
      else if(!backQuote && c==='{') {if(backDepth===0){from=i;break;}backDepth--;}
    }
    if(from===-1)throw new Error('Source object boundary missing');
    let depth=0,quote=false,escape=false,end=-1;
    for(let i=from;i<html.length;i++) {
      const c=html[i];
      if(quote) { if(escape) escape=false; else if(c==='\\') escape=true; else if(c==='"') quote=false; }
      else if(c==='"') quote=true;
      else if(c==='{') depth++;
      else if(c==='}' && --depth===0) {end=i+1;break;}
    }
    if(end===-1) throw new Error('Truncated source object');
    try {const value=JSON.parse(html.slice(from,end));if(value.__typename!==type)throw new Error();out.push(value);} catch {throw new Error('Source object is not JSON');}
    marker.lastIndex=end;
  }
  return out;
}
export function parseSchedule(html,now=new Date()) {
  const fetchedAt=now.toISOString().replace('.000Z','Z');
  const sourceHash=createHash('sha256').update(html).digest('hex');
  const matches=new Map();
  for(const event of extractObjects(html,'EventMatch')) {
    const normalized=normalizeEvent(event);
    if(!normalized) continue;
    const m={...normalized,observedAt:fetchedAt};
    if(matches.has(m.id) && JSON.stringify(matches.get(m.id))!==JSON.stringify(m)) throw new Error('Conflicting event copies');
    matches.set(m.id,m);
  }
  const ratings=new Map();
  for(const r of extractObjects(html,'TeamGPR')) {
    if(!r.id?.includes(':2026-01-01T00:00:00Z:')) continue;
    const v={id:r.team?.id,code:r.team?.code,elo:r.currentTeamGPR?.elo,gpr:r.currentTeamGPR?.gprScore,rank:r.currentTeamGPR?.rank,calculatedAt:r.currentTeamGPR?.dateCalculated,wins:r.teamMatchRecord?.wins,losses:r.teamMatchRecord?.losses,mapWins:r.teamGameRecord?.wins,mapLosses:r.teamGameRecord?.losses,observedAt:fetchedAt,sourceHash};
    if(ratings.has(v.id) && JSON.stringify(ratings.get(v.id))!==JSON.stringify(v)) throw new Error('Conflicting rating copies');
    ratings.set(v.id,v);
  }
  const groups=extractObjects(html,'EsportsData').filter(g=>g.events?.some(e=>e.league?.slug==='worlds' && e.tournament?.id===TOURNAMENT));
  const hasMore=!groups.length || groups.some(g=>g.pages?.newer!==null || g.pages?.older!==null);
  return validateSnapshot({schemaVersion:3,source:SOURCE,tournament:TOURNAMENT,fetchedAt,sourcePublishedAt:null,sourceHash,coverage:{hasMore},matches:[...matches.values()].sort((a,b)=>a.startTime.localeCompare(b.startTime)||a.id.localeCompare(b.id)),ratings:[...ratings.values()].sort((a,b)=>a.rank-b.rank)});
}
export async function fetchOfficial(fetcher=fetch) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try {
    let url=SOURCE;
    for(let redirects=0;redirects<=3;redirects++) {
      const parsed=new URL(url);
      if(parsed.origin!=='https://lolesports.com' || parsed.pathname!=='/en-US/leagues/worlds' || parsed.search || parsed.username || parsed.password) throw new Error('Source redirect rejected');
      const res=await fetcher(url,{redirect:'manual',credentials:'omit',signal:controller.signal,headers:{Accept:'text/html','User-Agent':'NEXUS-Worlds-Schedule/2.0 (daily public schedule reader)'}});
      if([301,302,303,307,308].includes(res.status)) {await res.body?.cancel();url=new URL(res.headers.get('location'),url).href;continue;}
      if(!res.ok || !res.headers.get('content-type')?.includes('text/html')) throw new Error('Official schedule unavailable');
      if(Number(res.headers.get('content-length'))>MAX_BYTES) {await res.body?.cancel();throw new Error('Source exceeds limit');}
      const reader=res.body.getReader(),chunks=[];let size=0;
      try {while(true) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw new Error('Source exceeds limit');chunks.push(value);}}
      finally {await reader.cancel().catch(()=>{});}
      return Buffer.concat(chunks).toString('utf8');
    }
    throw new Error('Too many redirects');
  } finally {clearTimeout(timer);}
}
export async function atomicJSON(file,value) {
  await mkdir(path.dirname(file),{recursive:true});
  const temp=`${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
    for(let attempt=0;;attempt++) {
      try {await rename(temp,file);break;}
      catch(error) {if(attempt>=3 || !['EPERM','EACCES','EBUSY'].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,40*(attempt+1)));}
    }
  }
  finally {await unlink(temp).catch(()=>{});}
}
export async function readSnapshot(root=ROOT) {return validateSnapshot(JSON.parse(await readFile(path.join(root,'data/schedule.json'),'utf8')));}
export async function readStatus(root=ROOT) {
  try {const s=JSON.parse(await readFile(path.join(root,'.cache/crawl-status.json'),'utf8'));return {window:typeof s.window==='string'?s.window:'',attemptedAt:typeof s.attemptedAt==='string'?s.attemptedAt:null,ok:s.ok===true,error:s.ok?'': '官方賽程暫時無法更新；保留上次成功資料。'};} catch{return null;}
}
let active;
export function refreshSchedule(options={}) {
  if(active)return active;
  active=refresh(options).finally(()=>{active=undefined;});return active;
}
async function refresh({root=ROOT,now,force=false,fetcher=fetchOfficial}={}) {
  const attemptTime=now||new Date(),window=dailyWindow(attemptTime),status=await readStatus(root);
  let previous;try {previous=await readSnapshot(root);} catch {}
  if(!force && previous && dailyWindow(new Date(previous.fetchedAt))===window && (!status?.attemptedAt || Date.parse(previous.fetchedAt)>=Date.parse(status.attemptedAt)))return {skipped:true,ok:true};
  if(!force && status?.window===window)return {skipped:true,ok:status.ok};
  const statusFile=path.join(root,'.cache/crawl-status.json');
  await atomicJSON(statusFile,{window,attemptedAt:attemptTime.toISOString(),ok:false});
  try {
    const html=await fetcher();
    const next=parseSchedule(html,now||new Date());
    // A truncated official page must not erase already known real fixtures.
    if(previous && next.coverage.hasMore) {
      const byId=new Map(previous.matches.map(m=>[m.id,m]));
      next.matches.forEach(m=>byId.set(m.id,m));
      next.matches=[...byId.values()].sort((a,b)=>a.startTime.localeCompare(b.startTime)||a.id.localeCompare(b.id));
      const ratingById=new Map(previous.ratings.map(r=>[r.id,r]));next.ratings.forEach(r=>ratingById.set(r.id,r));next.ratings=[...ratingById.values()].sort((a,b)=>a.rank-b.rank);
    }
    validateSnapshot(next);
    await atomicJSON(path.join(root,'data/schedule.json'),next);
    await atomicJSON(statusFile,{window,attemptedAt:attemptTime.toISOString(),ok:true});
    return {ok:true,count:next.matches.length};
  } catch {await atomicJSON(statusFile,{window,attemptedAt:attemptTime.toISOString(),ok:false});return {ok:false,error:'Official schedule refresh failed; previous snapshot retained.'};}
}
