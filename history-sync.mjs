import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {atomicJSON,ROOT} from './crawler.mjs';
import {validateHistory,emptyHistory,assertAppendOnly} from './history.mjs';
import {isoOK} from './schedule.mjs';

export const HISTORY_SOURCE='https://raw.githubusercontent.com/YatanLee/nexus-worlds-2026/main/data/prediction-history.json';
const MAX_BYTES=8*1024*1024;
async function load(file) {
  if((await stat(file)).size>MAX_BYTES)throw new Error('History exceeds limit');
  return validateHistory(JSON.parse(await readFile(file,'utf8')));
}
export async function readPublicHistory(root=ROOT) {
  let bundled=emptyHistory(),cached=null;
  try {bundled=await load(path.join(root,'data/prediction-history.json'));} catch {}
  try {cached=await load(path.join(root,'.cache/public-history.json'));} catch {}
  if(cached && Date.parse(cached.updatedAt||'1970-01-01')>=Date.parse(bundled.updatedAt||'1970-01-01')) {
    try {assertAppendOnly(bundled,cached);return cached;} catch {}
  }
  return bundled;
}
export async function readHistoryStatus(root=ROOT) {
  try {
    const s=JSON.parse(await readFile(path.join(root,'.cache/history-sync-status.json'),'utf8'));
    return {attemptedAt:isoOK(s.attemptedAt)?s.attemptedAt:null,ok:s.ok===true,error:s.ok?'':'公開預測紀錄暫時無法同步，保留最後成功版本。'};
  } catch {return null;}
}
export async function fetchPublicHistory(fetcher=fetch) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try {
    const res=await fetcher(HISTORY_SOURCE,{redirect:'manual',credentials:'omit',signal:controller.signal,headers:{Accept:'application/json','User-Agent':'NEXUS-Public-History/2.1'}});
    if(!res.ok || !/^(application\/json|text\/plain)(;|$)/i.test(res.headers.get('content-type')||'') || Number(res.headers.get('content-length'))>MAX_BYTES) {await res.body?.cancel();throw new Error('Public history unavailable');}
    const reader=res.body.getReader(),chunks=[];let size=0;
    try {while(true) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw new Error('History exceeds limit');chunks.push(value);}}
    finally {await reader.cancel().catch(()=>{});}
    return validateHistory(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } finally {clearTimeout(timer);}
}
let active;
export function syncPublicHistory(options={}) {
  if(active)return active;
  active=sync(options).finally(()=>{active=undefined;});return active;
}
async function sync({root=ROOT,now=new Date(),force=false,fetcher=fetchPublicHistory}={}) {
  const status=await readHistoryStatus(root);
  const elapsed=status?.attemptedAt?+now-Date.parse(status.attemptedAt):Infinity;
  if(!force && elapsed>=0 && elapsed<3600000)return {skipped:true,ok:status.ok};
  const statusFile=path.join(root,'.cache/history-sync-status.json');
  try {
    const previous=await readPublicHistory(root),next=validateHistory(await fetcher());
    assertAppendOnly(previous,next);
    await atomicJSON(path.join(root,'.cache/public-history.json'),next);
    await atomicJSON(statusFile,{attemptedAt:now.toISOString().replace('.000Z','Z'),ok:true});
    return {ok:true};
  } catch {await atomicJSON(statusFile,{attemptedAt:now.toISOString().replace('.000Z','Z'),ok:false});return {ok:false};}
}
