import {HISTORY_SCHEMA_VERSION, evaluationsView, validateHistory} from './history.mjs';
import {MODEL_VERSION} from './model.mjs';

const MINIMUM_SAMPLE = 20;
const EVEN_EPSILON = 1e-10;
const ISO = value => typeof value==='string' && Number.isFinite(Date.parse(value));
const canonicalTime = value => new Date(value).toISOString().replace('.000Z','Z');
const groupKey = (modelVersion,bestOf) => `${modelVersion}:${bestOf}`;

function emptyGroup(modelVersion,bestOf) {
  return {
    modelVersion,
    bestOf,
    period:{from:null,to:null},
    counts:{official:0,verified:0,pending:0,unverified:0,noBaseline:0,completedNoBaseline:0},
    reasons:{},
    exact:{hits:0,denominator:0,tiedTopExcluded:0,rate:null},
    direction:{hits:0,denominator:0,evenExcluded:0,rate:null},
    probability:{denominator:0,brier:null,logLoss:null,infinite:false},
    _brierSum:0,
    _logLossSum:0,
    _zeroProbability:false
  };
}

function recordPeriod(group,startTime) {
  if (!ISO(startTime)) return;
  const milliseconds=Date.parse(startTime);
  const time=canonicalTime(milliseconds);
  if (!group.period.from || milliseconds<Date.parse(group.period.from)) group.period.from=time;
  if (!group.period.to || milliseconds>Date.parse(group.period.to)) group.period.to=time;
}

function validActual(actual) {
  return actual && Number.isInteger(actual.a) && Number.isInteger(actual.b) && actual.a>=0 && actual.b>=0 && actual.a!==actual.b;
}

function addMetrics(group,row) {
  const forecast=row.forecast;
  if (row.status!=='verified' || !forecast || !validActual(row.actual) || !Number.isFinite(forecast.p) || !Number.isFinite(forecast.win) || !Array.isArray(forecast.outcomes) || !Array.isArray(forecast.top)) return;
  const actual=row.actual;
  const winnerA=actual.a>actual.b;
  const top=forecast.top;
  if (top.length===1 && Number.isInteger(top[0].a) && Number.isInteger(top[0].b)) {
    group.exact.denominator++;
    if (top[0].a===actual.a && top[0].b===actual.b) group.exact.hits++;
  } else if (top.length>1) {
    group.exact.tiedTopExcluded++;
  }
  if (Math.abs(forecast.p-.5)<=EVEN_EPSILON) {
    group.direction.evenExcluded++;
  } else {
    group.direction.denominator++;
    if ((forecast.p>.5)===winnerA) group.direction.hits++;
  }
  const outcome=forecast.outcomes.find(candidate=>candidate?.a===actual.a&&candidate?.b===actual.b);
  if (!outcome || !Number.isFinite(outcome.p) || outcome.p<0 || outcome.p>1) return;
  group.probability.denominator++;
  group._brierSum+=(forecast.win-(winnerA?1:0))**2;
  if (outcome.p===0) group._zeroProbability=true;
  else group._logLossSum-=Math.log(outcome.p);
}

function finalize(group) {
  if (group.exact.denominator>=MINIMUM_SAMPLE) group.exact.rate=group.exact.hits/group.exact.denominator;
  if (group.direction.denominator>=MINIMUM_SAMPLE) group.direction.rate=group.direction.hits/group.direction.denominator;
  if (group.probability.denominator>=MINIMUM_SAMPLE) {
    group.probability.brier=group._brierSum/group.probability.denominator;
    if (group._zeroProbability) group.probability.infinite=true;
    else group.probability.logLoss=group._logLossSum/group.probability.denominator;
  }
  delete group._brierSum;
  delete group._logLossSum;
  delete group._zeroProbability;
  return group;
}

/**
 * Aggregate one already-resolved current row per event/model. This helper is deliberately
 * validation-free so tests can exercise grouping boundaries with compact synthetic rows.
 */
export function aggregateHealth(rows,currentModelVersions=[]) {
  const models=new Set(currentModelVersions.filter(value=>typeof value==='string'&&value));
  for (const row of rows||[]) if (typeof row?.modelVersion==='string'&&row.modelVersion) models.add(row.modelVersion);
  const groups=new Map();
  const ensure=(modelVersion,bestOf) => {
    const key=groupKey(modelVersion,bestOf);
    if (!groups.has(key)) groups.set(key,emptyGroup(modelVersion,bestOf));
    return groups.get(key);
  };
  for (const modelVersion of models) for (const bestOf of ['all',1,3,5]) ensure(modelVersion,bestOf);
  for (const row of rows||[]) {
    if (!row || typeof row.modelVersion!=='string' || !row.modelVersion || ![1,3,5].includes(row.bestOf)) continue;
    const targets=[ensure(row.modelVersion,'all'),ensure(row.modelVersion,row.bestOf)];
    for (const group of targets) {
      group.counts.official++;
      recordPeriod(group,row.startTime);
      const countKey={verified:'verified',pending:'pending',unverified:'unverified','no-baseline':'noBaseline'}[row.status];
      if (countKey) group.counts[countKey]++;
      if (row.status==='no-baseline' && row.completed===true) group.counts.completedNoBaseline++;
      if (row.status==='unverified' && typeof row.reason==='string' && row.reason) group.reasons[row.reason]=(group.reasons[row.reason]||0)+1;
      addMetrics(group,row);
    }
  }
  const order={all:0,1:1,3:2,5:3};
  return [...groups.values()].map(finalize).sort((a,b)=>a.modelVersion.localeCompare(b.modelVersion)||order[a.bestOf]-order[b.bestOf]);
}

function snapshotById(snapshot) {
  const matches=new Map();
  for (const match of snapshot?.matches||[]) {
    if (match && typeof match.id==='string') matches.set(match.id,match);
  }
  return matches;
}

function coverageFixture(match) {
  return match && typeof match.id==='string' && /^\d{10,24}$/.test(match.id) && ISO(match.startTime) && [1,3,5].includes(match.bestOf) && ['scheduled','live','completed'].includes(match.state);
}

export function modelHealth(history,snapshot,now=new Date()) {
  validateHistory(history);
  const current=evaluationsView(history,snapshot);
  const frozen=new Map(history.baselines.map(baseline=>[baseline.id,baseline]));
  const matches=snapshotById(snapshot);
  const visible=new Set(current.rows.map(row=>row.matchId));
  // `evaluationsView` correctly declines unconfirmed/TBD teams for prediction
  // identity. Health coverage still needs to count those official fixtures.
  for (const match of snapshot?.matches||[]) {
    if (!coverageFixture(match) || visible.has(match.id)) continue;
    visible.add(match.id);
    current.rows.push({matchId:match.id,modelVersion:MODEL_VERSION,baseline:null,status:'no-baseline',reason:'no-baseline',actual:null,exactHit:null,winnerHit:null,revisionCount:0});
  }
  const rows=current.rows.map(row=>{
    const baseline=row.baseline ? frozen.get(row.baseline.id) : null;
    const match=matches.get(row.matchId);
    return {
      modelVersion:row.modelVersion,
      bestOf:baseline?.bestOf??match?.bestOf,
      startTime:baseline?.startTime??match?.startTime,
      status:row.status,
      reason:row.reason,
      actual:row.actual,
      completed:match?.state==='completed',
      forecast:baseline?.forecast??null
    };
  });
  return {
    schemaVersion:HISTORY_SCHEMA_VERSION,
    generatedAt:canonicalTime(now),
    historyUpdatedAt:history.updatedAt,
    groups:aggregateHealth(rows,[MODEL_VERSION])
  };
}
