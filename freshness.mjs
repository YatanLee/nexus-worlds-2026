export const SOURCE_MAX_AGE_MS=26*60*60*1000;
export const PLAYER_REVIEW_MS=7*24*60*60*1000;

const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const taipeiDate=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const date=new Date(`${value}T00:00:00+08:00`);
  return Number.isFinite(+date)&&new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)===value?date:null;
};

export function sourceFreshness(observedAt,now=Date.now()){
  if(!validTime(observedAt))return {state:'unknown',ageMs:null};
  const ageMs=+now-Date.parse(observedAt);
  if(ageMs<0)return {state:'future',ageMs};
  return {state:ageMs>SOURCE_MAX_AGE_MS?'stale':'fresh',ageMs};
}

export function playerReview(checkAt,now=Date.now()){
  const checked=taipeiDate(checkAt);
  if(!checked)return {state:'unknown',ageMs:null};
  const ageMs=+now-+checked;
  if(ageMs<0)return {state:'future',ageMs};
  return {state:ageMs>PLAYER_REVIEW_MS?'review':'current',ageMs};
}

export function recentOfficialResults(matches,teamId,now=Date.now(),limit=3){
  if(!Array.isArray(matches)||typeof teamId!=='string')return [];
  return matches.filter(match=>match?.state==='completed'&&validTime(match.startTime)&&Date.parse(match.startTime)<=+now&&Array.isArray(match.teams)&&match.teams.some(team=>team?.id===teamId))
    .sort((a,b)=>Date.parse(b.startTime)-Date.parse(a.startTime)).slice(0,Math.max(0,limit));
}

export function ratingResultLag(rating,teamId,matches,now=Date.now()){
  if(!validTime(rating?.calculatedAt))return {lagged:false,latest:null};
  const completed=recentOfficialResults(matches,teamId,now,Number.MAX_SAFE_INTEGER);
  const latest=completed.find(match=>Date.parse(match.startTime)>Date.parse(rating.calculatedAt))||null;
  return {lagged:Boolean(latest),latest};
}
