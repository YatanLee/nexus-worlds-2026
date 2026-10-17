import {createHash} from 'node:crypto';
import {MODEL_VERSION, baselineForecast} from './model.mjs';

export const HISTORY_SCHEMA_VERSION = 1;
export const HISTORY_TOURNAMENT = '115660540725177488';
export const MAX_BASELINES = 5000;
export const MAX_EVALUATIONS = 1500;
export const MAX_HISTORY_BYTES = 8 * 1024 * 1024;
const AGE_MS = 26 * 60 * 60 * 1000;
const ISO = value => typeof value==='string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().replace('.000Z','Z')===value;
const ID = value => typeof value==='string' && /^\d{10,24}$/.test(value);
const HASH = value => typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
const CODE = value => typeof value==='string' && /^[A-Za-z0-9]{1,12}$/.test(value);
const clone = value => structuredClone(value);
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const keys = (value, expected) => value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).length===expected.length && expected.every(key=>Object.hasOwn(value,key));
const orderedTeams = teams => [...teams].sort((a,b)=>a.id.localeCompare(b.id));
const canonicalTime = value => new Date(value).toISOString().replace('.000Z','Z');

export function emptyHistory() {
  return {schemaVersion:HISTORY_SCHEMA_VERSION,tournament:HISTORY_TOURNAMENT,updatedAt:null,baselines:[],evaluations:[]};
}

function assertProvenance(p) {
  if (!keys(p,['runId','attempt','codeCommit']) || !/^\d{1,24}$/.test(p.runId) || !Number.isInteger(p.attempt) || p.attempt<1 || !/^[a-f0-9]{40}$/.test(p.codeCommit)) throw new Error('Invalid CI provenance');
}
function assertRating(r) {
  if (!keys(r,['id','elo','calculatedAt','observedAt','sourceHash']) || !ID(r.id) || !Number.isInteger(r.elo) || r.elo<100 || r.elo>4000 || !ISO(r.calculatedAt) || !ISO(r.observedAt) || !HASH(r.sourceHash) || Date.parse(r.calculatedAt)>Date.parse(r.observedAt)) throw new Error('Invalid frozen rating');
}
function assertBaseline(b) {
  if (!keys(b,['id','eventId','modelVersion','capturedAt','deadline','fingerprint','startTime','bestOf','teams','matchObservedAt','sourceFetchedAt','sourceHash','ratings','forecast','provenance']) || typeof b.id!=='string' || !ID(b.eventId) || b.modelVersion!==MODEL_VERSION || !ISO(b.capturedAt) || !ISO(b.deadline) || !HASH(b.fingerprint) || !ISO(b.startTime) || ![1,3,5].includes(b.bestOf) || !Array.isArray(b.teams) || b.teams.length!==2 || !ISO(b.matchObservedAt) || !ISO(b.sourceFetchedAt) || !HASH(b.sourceHash) || !Array.isArray(b.ratings) || b.ratings.length!==2) throw new Error('Invalid baseline');
  const capturedAt=Date.parse(b.capturedAt), sourceFetchedAt=Date.parse(b.sourceFetchedAt), matchObservedAt=Date.parse(b.matchObservedAt);
  if (capturedAt>=Date.parse(b.deadline) || sourceFetchedAt>capturedAt || capturedAt-sourceFetchedAt>AGE_MS || matchObservedAt!==sourceFetchedAt || canonicalTime(new Date(Date.parse(b.startTime)-10*60*1000))!==b.deadline || !b.id.startsWith(`${b.provenance.runId}:${b.eventId}:${b.modelVersion}`)) throw new Error('Invalid baseline timing or identity');
  const sorted=orderedTeams(b.teams);
  if (!sorted.every((team,i)=>keys(team,['id','code']) && ID(team.id) && CODE(team.code) && team.id===b.teams[i].id) || sorted[0].id===sorted[1].id) throw new Error('Invalid canonical teams');
  if (b.fingerprint!==sha({eventId:b.eventId,teams:b.teams.map(team=>team.id),bestOf:b.bestOf,startTime:b.startTime})) throw new Error('Baseline fingerprint replay failed');
  if (b.ratings.some((r,i)=>r.id!==b.teams[i].id)) throw new Error('Ratings do not align with teams');
  b.ratings.forEach(rating=>{
    assertRating(rating);
    const observedAt=Date.parse(rating.observedAt);
    if (observedAt>capturedAt || capturedAt-observedAt>AGE_MS) throw new Error('Rating observation is outside the trusted capture window');
  }); assertProvenance(b.provenance);
  const f=b.forecast;
  if (!keys(f,['p','win','outcomes','top']) || !Number.isFinite(f.p) || f.p<0 || f.p>1 || !Number.isFinite(f.win) || f.win<0 || f.win>1 || !Array.isArray(f.outcomes) || !Array.isArray(f.top)) throw new Error('Invalid frozen forecast');
  const expected=baselineForecast(b.ratings[0].elo,b.ratings[1].elo,b.bestOf);
  if (JSON.stringify(f)!==JSON.stringify(expected)) throw new Error('Forecast replay failed');
}
function assertEvaluation(e, baselines, revision) {
  const baseline=baselines.get(e?.baselineId);
  const modern=keys(e,['id','baselineId','revision','resultHash','capturedAt','observedAt','actual']);
  const legacy=keys(e,['id','baselineId','resultHash','capturedAt','observedAt','actual']);
  if ((!modern&&!legacy) || typeof e.id!=='string' || !baseline || !HASH(e.resultHash) || !ISO(e.capturedAt) || !ISO(e.observedAt) || !Array.isArray(e.actual) || e.actual.length!==2) throw new Error('Invalid evaluation');
  if (modern && (!Number.isInteger(e.revision) || e.revision!==revision || e.revision<1 || e.id!==`${e.baselineId}:${e.revision}:${e.resultHash}`)) throw new Error('Invalid evaluation revision');
  if (legacy && e.id!==`${e.baselineId}:${e.resultHash}`) throw new Error('Invalid legacy evaluation');
  const target=(baseline.bestOf+1)/2;
  if (!e.actual.every((team,index)=>keys(team,['id','wins']) && ID(team.id) && Number.isInteger(team.wins) && team.wins>=0 && team.wins<=target && team.id===baseline.teams[index].id) || e.actual.filter(team=>team.wins===target).length!==1 || Date.parse(e.capturedAt)<Date.parse(baseline.capturedAt) || Date.parse(e.observedAt)<Date.parse(baseline.startTime) || Date.parse(e.observedAt)>Date.parse(e.capturedAt) || e.resultHash!==sha({eventId:baseline.eventId,teams:e.actual})) throw new Error('Invalid completed evaluation');
}
export function validateHistory(history) {
  if (!keys(history,['schemaVersion','tournament','updatedAt','baselines','evaluations']) || history.schemaVersion!==HISTORY_SCHEMA_VERSION || history.tournament!==HISTORY_TOURNAMENT || !(history.updatedAt===null||ISO(history.updatedAt)) || !Array.isArray(history.baselines) || !Array.isArray(history.evaluations) || history.baselines.length>MAX_BASELINES || history.evaluations.length>MAX_EVALUATIONS) throw new Error('Invalid history');
  const baselines=new Map();
  for (const baseline of history.baselines) { assertBaseline(baseline); if (baselines.has(baseline.id)) throw new Error('Duplicate baseline'); baselines.set(baseline.id,baseline); }
  const evaluationIds=new Set(), revisions=new Map();
  for (const evaluation of history.evaluations) {
    const revision=(revisions.get(evaluation.baselineId)||0)+1;
    assertEvaluation(evaluation,baselines,revision);
    if (evaluationIds.has(evaluation.id)) throw new Error('Duplicate evaluation');
    evaluationIds.add(evaluation.id); revisions.set(evaluation.baselineId,revision);
  }
  if (Buffer.byteLength(JSON.stringify(history),'utf8')>MAX_HISTORY_BYTES) throw new Error('History exceeds public size cap');
  return history;
}
export function assertAppendOnly(previous,next) {
  validateHistory(previous); validateHistory(next);
  for (const field of ['baselines','evaluations']) {
    if (next[field].length<previous[field].length) throw new Error('History is not append-only');
    for(let i=0;i<previous[field].length;i++) if (JSON.stringify(previous[field][i])!==JSON.stringify(next[field][i])) throw new Error('Published history was modified');
  }
  return true;
}
export function assertFreshPublication(previous,next,now=new Date()) {
  assertAppendOnly(previous,next);
  const before=new Set(previous.baselines.map(row=>row.id));
  const publishedAt=Date.parse(now);
  if (!Number.isFinite(publishedAt)) throw new Error('Invalid publication time');
  for (const baseline of next.baselines) {
    if (!before.has(baseline.id) && (Date.parse(baseline.capturedAt)>=Date.parse(baseline.deadline) || publishedAt>=Date.parse(baseline.deadline))) throw new Error('New baseline missed its publication deadline');
  }
  return true;
}
function snapshotMatch(match) {
  if (!match || !ID(match.id) || !ISO(match.startTime) || !ISO(match.observedAt) || ![1,3,5].includes(match.bestOf) || !['scheduled','live','completed'].includes(match.state) || !Array.isArray(match.teams) || match.teams.length!==2 || match.teams.some(team=>!ID(team.id))) return null;
  const teams=orderedTeams(match.teams.map(team=>({id:team.id,code:team.code,wins:team.wins})));
  if (!teams.every(team=>CODE(team.code))) return null;
  if(teams[0].id===teams[1].id) return null;
  return {...match,teams};
}
function fingerprint(match) { return sha({eventId:match.id,teams:match.teams.map(team=>team.id),bestOf:match.bestOf,startTime:match.startTime}); }
function fresh(value, now) { const time=Date.parse(value); return Number.isFinite(time) && time<=now && now-time<=AGE_MS; }
function buildBaseline(match,snapshot,provenance,capturedAt) {
  const deadline=canonicalTime(new Date(Date.parse(match.startTime)-10*60*1000));
  if (match.state!=='scheduled' || match.observedAt!==snapshot.fetchedAt || Date.parse(capturedAt)>=Date.parse(deadline) || !fresh(match.observedAt,Date.parse(capturedAt)) || !fresh(snapshot.fetchedAt,Date.parse(capturedAt))) return null;
  const lookup=new Map(snapshot.ratings?.map(r=>[r.id,r]));
  const ratings=match.teams.map(team=>lookup.get(team.id)).map(r=>r&&({id:r.id,elo:r.elo,calculatedAt:r.calculatedAt,observedAt:r.observedAt,sourceHash:r.sourceHash}));
  if (ratings.some(r=>!r || !fresh(r.observedAt,Date.parse(capturedAt)) || Date.parse(r.calculatedAt)>Date.parse(snapshot.fetchedAt) || !HASH(r.sourceHash))) return null;
  const base={id:`${provenance.runId}:${match.id}:${MODEL_VERSION}`,eventId:match.id,modelVersion:MODEL_VERSION,capturedAt,deadline,fingerprint:fingerprint(match),startTime:match.startTime,bestOf:match.bestOf,teams:match.teams.map(team=>({id:team.id,code:team.code})),matchObservedAt:match.observedAt,sourceFetchedAt:snapshot.fetchedAt,sourceHash:snapshot.sourceHash,ratings,forecast:baselineForecast(ratings[0].elo,ratings[1].elo,match.bestOf),provenance};
  assertBaseline(base); return base;
}
function scoreFor(match, baseline) {
  if (match.state!=='completed' || !Array.isArray(match.teams)) return null;
  const target=(baseline.bestOf+1)/2, byId=new Map(match.teams.map(team=>[team.id,team.wins]));
  const actual=baseline.teams.map(team=>({id:team.id,wins:byId.get(team.id)}));
  if (!actual.every(team=>Number.isInteger(team.wins)&&team.wins>=0&&team.wins<=target) || actual.filter(team=>team.wins===target).length!==1) return null;
  return actual;
}
export function selectLatestBaseline(history,eventId,modelVersion=MODEL_VERSION) {
  validateHistory(history);
  return history.baselines.filter(row=>row.eventId===eventId&&row.modelVersion===modelVersion).at(-1) || null;
}
function evaluationFor(history,baseline,actual,observedAt,capturedAt) {
  const resultHash=sha({eventId:baseline.eventId,teams:actual});
  const previous=history.evaluations.filter(row=>row.baselineId===baseline.id);
  if (previous.at(-1)?.resultHash===resultHash) return null;
  const revision=previous.length+1;
  return {id:`${baseline.id}:${revision}:${resultHash}`,baselineId:baseline.id,revision,resultHash,capturedAt,observedAt,actual};
}
export function buildHistory(previous,snapshot,provenance,now=new Date()) {
  const before=clone(previous); validateHistory(before); assertProvenance(provenance);
  if (!snapshot || snapshot.tournament!==HISTORY_TOURNAMENT || !ISO(snapshot.fetchedAt) || !HASH(snapshot.sourceHash) || !Array.isArray(snapshot.matches) || !Array.isArray(snapshot.ratings)) throw new Error('Invalid schedule snapshot for history');
  const capturedAt=canonicalTime(now); const next=clone(before);
  for (const raw of snapshot.matches) {
    const match=snapshotMatch(raw); if (!match) continue;
    const baseline=buildBaseline(match,snapshot,provenance,capturedAt);
    if (baseline) {
      const same=next.baselines.find(row=>row.id===baseline.id);
      // A GitHub retry keeps the original pregame capture for its run/event/model key.
      // It must never refresh that historical observation with a later wall-clock time.
      if (!same) next.baselines.push(baseline);
    }
  }
  const current=new Map(snapshot.matches.map(raw=>[raw.id,snapshotMatch(raw)]).filter(([,match])=>match));
  for (const baseline of next.baselines) {
    const match=current.get(baseline.eventId);
    if (!match || fingerprint(match)!==baseline.fingerprint) continue;
    const actual=scoreFor(match,baseline); if (!actual) continue;
    const evaluation=evaluationFor(next,baseline,actual,match.observedAt,capturedAt); if (evaluation) next.evaluations.push(evaluation);
  }
  if (next.baselines.length>MAX_BASELINES || next.evaluations.length>MAX_EVALUATIONS) throw new Error('History cap reached');
  next.updatedAt=(next.baselines.length!==before.baselines.length||next.evaluations.length!==before.evaluations.length)?capturedAt:before.updatedAt;
  validateHistory(next); assertAppendOnly(before,next); return next;
}
function latestByKey(history) { const map=new Map(); for(const baseline of history.baselines) map.set(`${baseline.eventId}:${baseline.modelVersion}`,baseline); return map; }
export function evaluationsView(history,snapshot) {
  validateHistory(history);
  const matches=new Map((snapshot?.matches||[]).map(raw=>[raw.id,snapshotMatch(raw)]).filter(([,match])=>match));
  const evaluations=new Map(history.evaluations.map(row=>[row.baselineId,row]));
  const latest=latestByKey(history);
  for (const match of matches.values()) {
    const key=`${match.id}:${MODEL_VERSION}`;
    if (!latest.has(key)) latest.set(key,null);
  }
  const revisions=new Map();
  for (const baseline of history.baselines) { const key=`${baseline.eventId}:${baseline.modelVersion}`; revisions.set(key,(revisions.get(key)||0)+1); }
  const rows=[...latest.entries()].map(([key,baseline])=>{
    if (!baseline) {
      const [matchId,modelVersion]=key.split(':');
      return {matchId,modelVersion,baseline:null,status:'no-baseline',reason:'no-baseline',actual:null,exactHit:null,winnerHit:null,revisionCount:0};
    }
    const match=matches.get(baseline.eventId);
    const row={matchId:baseline.eventId,modelVersion:baseline.modelVersion,baseline:{id:baseline.id,capturedAt:baseline.capturedAt,startTime:baseline.startTime,teamIds:baseline.teams.map(team=>team.id),teamCodes:baseline.teams.map(team=>team.code),bestOf:baseline.bestOf,top:baseline.forecast.top,win:baseline.forecast.win,modelVersion:baseline.modelVersion,runId:baseline.provenance.runId},status:'pending',reason:null,actual:null,exactHit:null,winnerHit:null,revisionCount:revisions.get(key)||0};
    if (!match) { if (snapshot?.coverage?.hasMore===false) {row.status='unverified';row.reason='fixture-missing';} return row; }
    if (fingerprint(match)!==baseline.fingerprint) {row.status='unverified';row.reason='fixture-changed';return row;}
    const evaluation=evaluations.get(baseline.id),currentActual=scoreFor(match,baseline);
    if (!currentActual) {if(evaluation)row.reason='official-result-not-final';return row;}
    if (!evaluation || JSON.stringify(evaluation.actual)!==JSON.stringify(currentActual)) {
      row.reason='result-revision-pending';row.actual={a:currentActual[0].wins,b:currentActual[1].wins};return row;
    }
    row.status='verified';row.actual={a:evaluation.actual[0].wins,b:evaluation.actual[1].wins};
    const top=baseline.forecast.top;
    if (top.length===1) row.exactHit=top[0].a===evaluation.actual[0].wins&&top[0].b===evaluation.actual[1].wins;
    if (Math.abs(baseline.forecast.p-.5)>1e-10) row.winnerHit=(baseline.forecast.p>.5)===(evaluation.actual[0].wins>evaluation.actual[1].wins);
    return row;
  });
  return {schemaVersion:HISTORY_SCHEMA_VERSION,updatedAt:history.updatedAt,rows};
}
