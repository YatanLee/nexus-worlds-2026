import { PRESETS, MARKET_LABELS } from './data.mjs';
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Exhaustive terminal score distribution for independent, identically distributed maps.
export function seriesOutcomes(p, bestOf) {
  if (![1,3,5].includes(bestOf) || !Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('Invalid series inputs');
  const target = (bestOf + 1) / 2;
  const result = [];
  function walk(a,b,prob) {
    if (a === target || b === target) { result.push({a,b,p:prob}); return; }
    walk(a+1,b,prob*p); walk(a,b+1,prob*(1-p));
  }
  walk(0,0,1);
  const merged = new Map();
  result.forEach(o => { const key=`${o.a}:${o.b}`; merged.set(key,{...o,p:(merged.get(key)?.p || 0)+o.p}); });
  return [...merged.values()];
}
export function mapProbability(scores, preset='balanced') {
  const weights=(PRESETS[preset] || PRESETS.balanced).weights;
  const average=weights.reduce((sum,w,i)=>sum+w*clamp(Number(scores[i]) || 0,0,100),0);
  return clamp(1/(1+Math.exp(-(average-50)/24)),.1,.9);
}
export function markets(match, scores=match.scores, preset='balanced', totalLine=(match.bestOf===5?3.5:2.5)) {
  const p=mapProbability(scores,preset), outcomes=seriesOutcomes(p,match.bestOf);
  const win=outcomes.filter(o=>o.a>o.b).reduce((s,o)=>s+o.p,0);
  const pair=(key,pa,labels=[match.a,match.b])=>({key,label:MARKET_LABELS[key],options:[{label:labels[0],p:pa},{label:labels[1],p:1-pa}]});
  const list=[pair('winner',win),pair('map',p)];
  if (match.bestOf>1) {
    list.push(pair('handicap',outcomes.filter(o=>o.a-o.b>1.5).reduce((s,o)=>s+o.p,0),[`${match.a} −1.5 局`,`${match.b} +1.5 局`]));
    list.push(pair('total',outcomes.filter(o=>o.a+o.b>totalLine).reduce((s,o)=>s+o.p,0),[`大 ${totalLine} 局`,`小 ${totalLine} 局`]));
    list.push({key:'score',label:MARKET_LABELS.score,options:outcomes.map(o=>({label:`${match.a} ${o.a} : ${o.b} ${match.b}`,p:o.p}))});
  }
  // Event probabilities are deliberately unavailable without event-specific observations.
  ['kill','dragon','tower','baron'].forEach(key=>list.push({key,label:MARKET_LABELS[key],unavailable:true,options:[{label:match.a,p:null},{label:match.b,p:null}]}));
  return {p,win,outcomes,list};
}
export function implied(odds) {
  if (!Array.isArray(odds) || odds.some(o=>!Number.isFinite(o) || o<=1 || o>1000)) return null;
  const raw=odds.map(o=>1/o),sum=raw.reduce((a,b)=>a+b,0);
  return {raw,normalized:raw.map(p=>p/sum),margin:sum-1};
}

export function validateMatch(value) {
  if (!value || typeof value!=='object' || ![1,3,5].includes(value.bestOf) || !['playin','swiss','knockout'].includes(value.stage)) return null;
  const clean = v => typeof v==='string' ? v.trim().slice(0,60) : '';
  const a=clean(value.a), b=clean(value.b);
  if (!a || !b || a===b || !Array.isArray(value.scores) || value.scores.length!==5 || value.scores.some(x=>!Number.isFinite(x)||x<0||x>100)) return null;
  if (!implied(value.odds) || value.odds.length!==2) return null;
  const id=typeof value.id==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value.id) ? value.id : `custom-${crypto.randomUUID()}`;
  return {id,a,b,nameA:clean(value.nameA)||a,nameB:clean(value.nameB)||b,regionA:clean(value.regionA)||'自訂',regionB:clean(value.regionB)||'自訂',stage:value.stage,bestOf:value.bestOf,scores:[...value.scores],odds:[...value.odds],colorA:'#75c8ed',colorB:'#b7a6f7',custom:true};
}
