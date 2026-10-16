import {predictionAvailability} from './schedule.mjs';
export const MODEL_VERSION = 'elo-exact-score-v1';
const MAX_RATING_AGE_MS = 26 * 60 * 60 * 1000;
export function seriesOutcomes(p,bestOf) {
  if(![1,3,5].includes(bestOf)||!Number.isFinite(p)||p<0||p>1) throw new RangeError('Invalid series inputs');
  const target=(bestOf+1)/2,merged=new Map();
  function walk(a,b,chance) {
    if(a===target||b===target) {const key=`${a}:${b}`;merged.set(key,{a,b,p:(merged.get(key)?.p||0)+chance});return;}
    walk(a+1,b,chance*p);walk(a,b+1,chance*(1-p));
  }
  walk(0,0,1);return [...merged.values()];
}
export function baselineForecast(eloA,eloB,bestOf) {
  if (!Number.isFinite(eloA) || !Number.isFinite(eloB)) throw new RangeError('Invalid Elo inputs');
  const p=1/(1+10**((eloB-eloA)/400));
  const outcomes=seriesOutcomes(p,bestOf).sort((x,y)=>y.p-x.p||x.a-y.a);
  const win=outcomes.filter(o=>o.a>o.b).reduce((s,o)=>s+o.p,0);
  return {p,win,outcomes,top:outcomes.filter(o=>Math.abs(o.p-outcomes[0].p)<1e-10)};
}
function usableRating(r,now) {
  if (!r || !Number.isFinite(r.elo) || typeof r.observedAt!=='string' || typeof r.calculatedAt!=='string') return false;
  const observed=Date.parse(r.observedAt), calculated=Date.parse(r.calculatedAt);
  return Number.isFinite(observed) && Number.isFinite(calculated) && observed<=now && calculated<=observed && now-observed<=MAX_RATING_AGE_MS;
}
export function forecast(match,ratings,adjustment=0,now=Date.now()) {
  if(predictionAvailability(match,now)!=='ready')return null;
  const a=ratings.find(r=>r.id===match.teams[0].id),b=ratings.find(r=>r.id===match.teams[1].id);
  if(!usableRating(a,now)||!usableRating(b,now))return null;
  const delta=Math.max(-100,Math.min(100,Number(adjustment)||0));
  const core=baselineForecast(a.elo+delta,b.elo,match.bestOf);
  return {...core,ratings:[a,b],adjustment:delta};
}
export function mysticForecast(match,pro,theme='underdog') {
  if(!pro)return null;
  // Narrative scenarios are deliberately isolated from all model probabilities.
  let side=pro.win<.5?0:1;
  if(theme==='legacy')side=match.teams[0].code==='C9'?0:match.teams[1].code==='C9'?1:1-side;
  if(theme==='momentum')side=1-side;
  const target=(match.bestOf+1)/2;
  return {side,a:side===0?target:target-1,b:side===1?target:target-1};
}
