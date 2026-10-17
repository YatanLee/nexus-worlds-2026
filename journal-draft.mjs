import {emptyJournal,entryState,fixtureRef,setPregame} from './journal.mjs';
import {predictionAvailability} from './schedule.mjs';
import {sourceFreshness} from './freshness.mjs';

const lanes=new Set(['team','region','worlds','recent']);
const sourceHosts=new Set(['lolesports.com','na.leagueoflegends.com','www.leagueoflegends.com','ge.globo.com']);
function reject(code){const error=new Error(`Private evidence draft: ${code}`);error.code=code;throw error;}

// Transient UI drafts use the full official fixture identity, never only a match ID.
export function draftKey(match){return JSON.stringify(fixtureRef(match));}

export function fieldsFromEntry(entry){
 return structuredClone({predictedScore:entry?.predictedScore??null,reason:entry?.reason??'',keyPlayerObservation:entry?.keyPlayerObservation??'',mysticChoice:entry?.mysticChoice??null});
}

export function quoteMysticEvidence({match,entry,assessment,evidenceKey,stance,fields=fieldsFromEntry(entry),now=Date.now()}={}){
 if(!match||match.state!=='scheduled'||predictionAvailability(match,now)!=='ready'||sourceFreshness(match.observedAt,now).state!=='fresh'||(entry&&entryState(entry,match,now)!=='open'))reject('unavailable');
 let fixture;try{fixture=fixtureRef(match);}catch{reject('unavailable');}
 if(!['support','counter'].includes(stance)||typeof evidenceKey!=='string'||evidenceKey.length>110)reject('invalid');
 const parts=evidenceKey.split(':');
 if(parts.length!==2||!lanes.has(parts[0])||!/^[a-z0-9-]+$/.test(parts[1]))reject('invalid');
 const card=Array.isArray(assessment?.[parts[0]])?assessment[parts[0]].find(item=>item?.id===parts[1]):null;
 if(!card||!['title','fact','interpretation','scopeLabel','applies','limitation'].every(key=>typeof card[key]==='string'&&card[key].length>0)||!Number.isInteger(card.year)||!card.source||!['title','url','checkedAt'].every(key=>typeof card.source[key]==='string'&&card.source[key].length>0))reject('invalid');
 try{const url=new URL(card.source.url);if(url.protocol!=='https:'||url.username||url.password||url.port||!sourceHosts.has(url.hostname))reject('invalid');}catch{reject('invalid');}
 let checked;try{checked=setPregame(emptyJournal(),match,fields,now).entries[fixture.id];}catch{reject('invalid');}
 const marker=`【玄學${stance==='support'?'支持':'反例'}｜${evidenceKey}】`;
 if(checked.reason.includes(marker))reject('duplicate');
 const block=[marker,`案例：${card.title}（${card.year}）`,`事實：${card.fact}`,`觀賽解讀：${card.interpretation}`,`適用範圍：${card.scopeLabel}；${card.applies}`,`保留條件：${card.limitation}`,`來源：${card.source.title} · 查核 ${card.source.checkedAt}`,card.source.url,'這是我的觀賽論點，不是勝率或結果保證。'].join('\n');
 if(block.length>1200)reject('invalid');
 const nextReason=checked.reason?`${checked.reason}\n\n${block}`:block;
 if(nextReason.length>3000)reject('limit');
 const next=fieldsFromEntry(checked);next.reason=nextReason;
 // Reuse the private journal's existing field/byte limits without changing its schema.
 try{setPregame(emptyJournal(),match,next,now);}catch{reject('invalid');}
 return next;
}
