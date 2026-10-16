export const SOURCE = 'https://lolesports.com/en-US/leagues/worlds';
export const TOURNAMENT = '115660540725177488';
export const STAGES = { all:'全部', playin:'入圍賽', swiss:'瑞士輪', knockout:'淘汰賽' };
const rounds = { 'Play-Ins':'playin', Swiss:'swiss', Quarterfinals:'knockout', Semifinals:'knockout', Finals:'knockout' };
const idOK = x => typeof x === 'string' && /^\d{10,24}$/.test(x);
const textOK = (x,n=80) => typeof x === 'string' && x.length > 0 && x.length <= n && !/[\x00-\x1f<>]/.test(x);
export const isoOK = x => typeof x === 'string' && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().replace('.000Z','Z') === x;
export function dailyWindow(now = new Date()) {
  // Daily refresh boundary: 06:00 Asia/Taipei (22:00 UTC on the preceding day).
  return new Date(+now + 2*3600000).toISOString().slice(0,10);
}
export function timeTW(value, full=true) {
  return new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',...(full?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:{})}).format(new Date(value));
}
export function normalizeEvent(e) {
  if (e?.league?.slug !== 'worlds' || e?.tournament?.name !== '2026' || e?.tournament?.id !== TOURNAMENT) return null;
  if (!idOK(e.id) || !isoOK(e.startTime) || !e.startTime.startsWith('2026-') || !rounds[e.blockName] || ![1,3,5].includes(e.match?.strategy?.count)) throw new Error('Invalid official event');
  const state = {unstarted:'scheduled',inProgress:'live',completed:'completed'}[e.state];
  if (!state || !Array.isArray(e.matchTeams) || e.matchTeams.length !== 2) throw new Error('Invalid event state or teams');
  const target=(e.match.strategy.count+1)/2;
  const teams=e.matchTeams.map(t=>{
    if (!(t.teamId==='0' || idOK(t.teamId)) || !textOK(t.code,12) || !textOK(t.name)) throw new Error('Invalid team');
    if (t.teamId==='0' && (t.code!=='TBD' || t.name!=='TBD')) throw new Error('Invalid placeholder');
    const wins=t.result?.gameWins ?? null;
    if (wins!==null && (!Number.isInteger(wins) || wins<0 || wins>target)) throw new Error('Invalid result');
    return {id:t.teamId,code:t.code,name:t.name,region:typeof t.homeLeague?.regionSlug==='string'?t.homeLeague.regionSlug.slice(0,20).toUpperCase():'—',wins};
  });
  if (teams[0].id!=='0' && teams[0].id===teams[1].id) throw new Error('Duplicate opponents');
  if (state==='scheduled' && teams.some(t=>t.wins!==null && t.wins!==0)) throw new Error('Scheduled event has results');
  if (teams.some(t=>t.id==='0') && (state!=='scheduled' || teams.some(t=>t.wins!==null && t.wins!==0))) throw new Error('Placeholder event has results');
  if (state==='completed' && (teams.some(t=>t.wins===null) || teams.filter(t=>t.wins===target).length!==1)) throw new Error('Invalid completed score');
  if (state==='live' && (teams.some(t=>t.wins===null) || teams.filter(t=>t.wins===target).length>1)) throw new Error('Invalid live score');
  return {id:e.id,startTime:e.startTime,stage:rounds[e.blockName],round:e.blockName,bestOf:e.match.strategy.count,state,teams};
}
export function validateSnapshot(s) {
  if (!s || ![2,3].includes(s.schemaVersion) || s.source!==SOURCE || s.tournament!==TOURNAMENT || !isoOK(s.fetchedAt) || s.sourcePublishedAt!==null || !/^[a-f0-9]{64}$/.test(s.sourceHash) || !Array.isArray(s.matches) || s.matches.length<1 || s.matches.length>300 || !Array.isArray(s.ratings) || s.ratings.length>150 || typeof s.coverage?.hasMore!=='boolean') throw new Error('Invalid schedule snapshot');
  if(Object.keys(s).some(k=>!['schemaVersion','source','tournament','fetchedAt','sourcePublishedAt','sourceHash','coverage','matches','ratings'].includes(k)))throw new Error('Unexpected schedule field');
  const ids=new Set();
  for (const m of s.matches) {
    const {observedAt,...fields}=m;
    const normalized=normalizeEvent({id:m.id,startTime:m.startTime,blockName:m.round,state:{scheduled:'unstarted',live:'inProgress',completed:'completed'}[m.state],league:{slug:'worlds'},tournament:{name:'2026',id:TOURNAMENT},match:{strategy:{count:m.bestOf}},matchTeams:m.teams?.map(t=>({teamId:t.id,code:t.code,name:t.name,homeLeague:{regionSlug:t.region},result:{gameWins:t.wins}}))});
    if (JSON.stringify(normalized)!==JSON.stringify(fields) || ids.has(m.id) || !isoOK(observedAt) || Date.parse(observedAt)>Date.parse(s.fetchedAt)) throw new Error('Invalid or duplicate fixture');
    ids.add(m.id);
  }
  const ratingIds=new Set();
  for (const r of s.ratings) {
    if (!idOK(r.id) || ratingIds.has(r.id) || !textOK(r.code,12) || !Number.isInteger(r.elo) || r.elo<100 || r.elo>4000 || !Number.isInteger(r.rank) || r.rank<1 || r.rank>500 || !Number.isInteger(r.gpr) || r.gpr<0 || r.gpr>5000 || !isoOK(r.calculatedAt) || !r.calculatedAt.startsWith('2026-') || Date.parse(r.calculatedAt)>Date.parse(s.fetchedAt) || ![r.wins,r.losses,r.mapWins,r.mapLosses].every(n=>Number.isInteger(n)&&n>=0&&n<=500)) throw new Error('Invalid team rating');
    ratingIds.add(r.id);
    const allowed=['id','code','elo','gpr','rank','calculatedAt','wins','losses','mapWins','mapLosses',...(s.schemaVersion===3?['observedAt','sourceHash']:[])];
    if(Object.keys(r).some(k=>!allowed.includes(k)))throw new Error('Unexpected rating field');
    if(s.schemaVersion===3 && !((r.observedAt===null && r.sourceHash===null) || (isoOK(r.observedAt) && Date.parse(r.observedAt)<=Date.parse(s.fetchedAt) && Date.parse(r.calculatedAt)<=Date.parse(r.observedAt) && /^[a-f0-9]{64}$/.test(r.sourceHash))))throw new Error('Invalid rating provenance');
  }
  // Legacy rows have unknown provenance; never invent an observation time for them.
  return s.schemaVersion===2?{...s,schemaVersion:3,ratings:s.ratings.map(r=>({...r,observedAt:null,sourceHash:null}))}:s;
}
export function predictionAvailability(m, now=Date.now()) {
  if (m.state==='completed') return 'completed';
  if (m.state==='live') return 'live';
  if (m.teams.some(t=>t.id==='0')) return 'tbd';
  if (Date.parse(m.startTime)<=+now) return 'pending';
  if (m.observedAt && +now-Date.parse(m.observedAt)>26*3600000) return 'stale';
  return 'ready';
}
