const VERSION=3;
const MAX_BYTES=1024*1024;
const MAX_ENTRIES=200;
const MAX_PERSONAL=100;
const MAX_TEXT=3000;
const MAX_PLAYER=2000;
const THEMES=new Set(['underdog','legacy','momentum']);
const ID=value=>typeof value==='string'&&/^\d{10,24}$/.test(value);
const ISO=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().replace('.000Z','Z')===value;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const canonical=value=>new Date(value).toISOString().replace('.000Z','Z');
const time=value=>{
  const parsed=value instanceof Date?value.getTime():typeof value==='number'?value:Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('Invalid private journal time');
  return parsed;
};
const clone=value=>structuredClone(value);
const bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
const text=(value,max=MAX_TEXT)=>typeof value==='string'&&value.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value);
const canonicalIds=ids=>[...ids].sort((a,b)=>a.localeCompare(b));

function assertFixture(fixture) {
  if (!exact(fixture,['id','teamIds','bestOf','startTime'])||!ID(fixture.id)||!Array.isArray(fixture.teamIds)||fixture.teamIds.length!==2||!fixture.teamIds.every(ID)||fixture.teamIds.includes('0')||fixture.teamIds[0]===fixture.teamIds[1]||JSON.stringify(fixture.teamIds)!==JSON.stringify(canonicalIds(fixture.teamIds))||![1,3,5].includes(fixture.bestOf)||!ISO(fixture.startTime)) throw new Error('Invalid private fixture reference');
}
function assertScore(score,fixture) {
  if (score===null) return;
  const target=(fixture.bestOf+1)/2;
  if (!Array.isArray(score)||score.length!==2||!score.every((side,index)=>exact(side,['id','wins'])&&side.id===fixture.teamIds[index]&&Number.isInteger(side.wins)&&side.wins>=0&&side.wins<=target)||score.filter(side=>side.wins===target).length!==1) throw new Error('Invalid private exact score');
}
function assertEntry(entry) {
  if (!exact(entry,['fixture','predictedScore','predictedAt','reason','keyPlayerObservation','mysticChoice','reflection'])) throw new Error('Invalid private journal entry');
  assertFixture(entry.fixture);assertScore(entry.predictedScore,entry.fixture);
  if ((entry.predictedScore===null&&entry.predictedAt!==null)||(entry.predictedScore!==null&&(!ISO(entry.predictedAt)||Date.parse(entry.predictedAt)>=Date.parse(entry.fixture.startTime)))||!text(entry.reason)||!text(entry.keyPlayerObservation,MAX_PLAYER)||!(entry.mysticChoice===null||THEMES.has(entry.mysticChoice))||!text(entry.reflection)) throw new Error('Invalid private journal entry fields');
}
function assertMap(value,limit,validator,label) {
  if (!plain(value)||Object.keys(value).length>limit) throw new Error(`Invalid ${label}`);
  for (const [key,item] of Object.entries(value)) if (!ID(key)||!validator(item)) throw new Error(`Invalid ${label}`);
}
function assertSettings(settings) {
  if (!exact(settings,['theme','adjustments'])||!THEMES.has(settings.theme)) throw new Error('Invalid private settings');
  assertMap(settings.adjustments,MAX_PERSONAL,value=>Number.isInteger(value)&&value>=-100&&value<=100,'private adjustments');
}
function assertStore(store) {
  if (!exact(store,['version','saved','notes','settings','entries'])||store.version!==VERSION||!Array.isArray(store.saved)||store.saved.length>MAX_PERSONAL||new Set(store.saved).size!==store.saved.length||!store.saved.every(ID)) throw new Error('Invalid private journal');
  assertMap(store.notes,MAX_PERSONAL,value=>text(value),'private notes');assertSettings(store.settings);
  if (!plain(store.entries)||Object.keys(store.entries).length>MAX_ENTRIES) throw new Error('Invalid private entries');
  for (const [id,entry] of Object.entries(store.entries)) { if (!ID(id)||entry?.fixture?.id!==id) throw new Error('Invalid private entry ID');assertEntry(entry); }
  if (bytes(store)>MAX_BYTES) throw new Error('Private journal exceeds size limit');
}

export function emptyJournal() { return {version:VERSION,saved:[],notes:{},settings:{theme:'underdog',adjustments:{}},entries:{}}; }
export function validateJournal(store) { assertStore(store);return true; }

export function fixtureRef(match) {
  const teams=match?.teams;
  if (!match||!ID(match.id)||!Array.isArray(teams)||teams.length!==2||teams.some(team=>!ID(team?.id)||team.id==='0')||teams[0].id===teams[1].id||![1,3,5].includes(match.bestOf)||!ISO(match.startTime)) throw new Error('A confirmed official fixture is required');
  const fixture={id:match.id,teamIds:canonicalIds(teams.map(team=>team.id)),bestOf:match.bestOf,startTime:match.startTime};
  assertFixture(fixture);return fixture;
}
function sameFixture(a,b) { return !!a&&!!b&&a.id===b.id&&a.bestOf===b.bestOf&&a.startTime===b.startTime&&JSON.stringify(a.teamIds)===JSON.stringify(b.teamIds); }
export function entryState(entry,match,now=new Date()) {
  try { assertEntry(entry); } catch { return 'detached'; }
  let fixture;try { fixture=fixtureRef(match); } catch { return 'detached'; }
  if (!sameFixture(entry.fixture,fixture)) return 'detached';
  if (time(now)>=Date.parse(fixture.startTime)||match.state==='live'||match.state==='completed') return 'locked';
  return 'open';
}
function validatePregameFields(fields) {
  const allowed=['predictedScore','reason','keyPlayerObservation','mysticChoice'];
  if (!plain(fields)||Object.keys(fields).some(key=>!allowed.includes(key))) throw new Error('Invalid private pregame fields');
}
function blankEntry(fixture) { return {fixture,predictedScore:null,predictedAt:null,reason:'',keyPlayerObservation:'',mysticChoice:null,reflection:''}; }
function finalStore(store) { assertStore(store);return clone(store); }

export function setPregame(store,match,fields,now=new Date()) {
  assertStore(store);validatePregameFields(fields);const nowAt=time(now);const fixture=fixtureRef(match);
  const existing=store.entries[fixture.id];
  if (existing&&entryState(existing,match,now)!=='open') throw new Error('Private pregame entry is locked or detached');
  if (!existing&&(nowAt>=Date.parse(fixture.startTime)||match.state==='live'||match.state==='completed')) throw new Error('Private pregame entry is locked');
  const entry=clone(existing||blankEntry(fixture));
  if (Object.hasOwn(fields,'predictedScore')) {
    assertScore(fields.predictedScore,fixture);entry.predictedScore=clone(fields.predictedScore);entry.predictedAt=fields.predictedScore===null?null:canonical(nowAt);
  }
  for (const key of ['reason','keyPlayerObservation','mysticChoice']) if (Object.hasOwn(fields,key)) entry[key]=fields[key];
  assertEntry(entry);
  const next=finalStore(store);next.entries[fixture.id]=entry;assertStore(next);return next;
}

export function setReflection(store,matchId,reflection,matches,now=new Date()) {
  assertStore(store);const nowAt=time(now);if(!ID(matchId)||!text(reflection)) throw new Error('Invalid private reflection');
  const existing=store.entries[matchId];
  const match=(matches||[]).find(item=>item?.id===matchId);
  if (!existing) {
    const fixture=fixtureRef(match);
    if (!(nowAt>=Date.parse(fixture.startTime)||match.state==='live'||match.state==='completed')) throw new Error('Reflection is available after the fixture starts');
    const next=finalStore(store);next.entries[matchId]=blankEntry(fixture);next.entries[matchId].reflection=reflection;assertStore(next);return next;
  }
  const hasStarted=nowAt>=Date.parse(existing.fixture.startTime)||match?.state==='live'||match?.state==='completed';
  if (!hasStarted) throw new Error('Reflection is available after the fixture starts');
  const next=finalStore(store);next.entries[matchId].reflection=reflection;assertStore(next);return next;
}

function knownMatches(matches) { return new Map((matches||[]).filter(match=>{try{fixtureRef(match);return true;}catch{return false;}}).map(match=>[match.id,match])); }
export function migrateLegacy(legacy,matches) {
  if (legacy?.version===VERSION) { assertStore(legacy);return clone(legacy); }
  const result=emptyJournal();if(!plain(legacy)||legacy.version!==2) return result;
  if (Array.isArray(legacy.saved)) for (const id of legacy.saved) if (ID(id)&&!result.saved.includes(id)&&result.saved.length<MAX_PERSONAL) result.saved.push(id);
  if (plain(legacy.notes)) for (const [id,note] of Object.entries(legacy.notes)) if (ID(id)&&text(note)&&Object.keys(result.notes).length<MAX_PERSONAL) result.notes[id]=note;
  if (THEMES.has(legacy.theme)) result.settings.theme=legacy.theme;
  if (plain(legacy.adjustments)) for (const [id,value] of Object.entries(legacy.adjustments)) if (ID(id)&&Number.isInteger(value)&&value>=-100&&value<=100&&Object.keys(result.settings.adjustments).length<MAX_PERSONAL) result.settings.adjustments[id]=value;
  assertStore(result);return result;
}

export function exportBackup(store,now=new Date()) {
  assertStore(store);const backup={version:VERSION,exportedAt:canonical(now),journal:clone(store)};
  const text=JSON.stringify(backup);if(bytes(text)>MAX_BYTES) throw new Error('Private backup exceeds size limit');return text;
}
function parseBackup(textValue) {
  if(typeof textValue!=='string'||bytes(textValue)>MAX_BYTES) throw new Error('Invalid private backup');
  let backup;try{backup=JSON.parse(textValue);}catch{throw new Error('Invalid private backup');}
  if (!exact(backup,['version','exportedAt','journal'])||backup.version!==VERSION||!ISO(backup.exportedAt)) throw new Error('Invalid private backup');
  assertStore(backup.journal);return backup.journal;
}
function pristine(store) { return store.saved.length===0&&Object.keys(store.notes).length===0&&Object.keys(store.entries).length===0&&store.settings.theme==='underdog'&&Object.keys(store.settings.adjustments).length===0; }
export function importBackup(store,textValue,matches,now=new Date()) {
  assertStore(store);const nowAt=time(now);const incoming=parseBackup(textValue);const known=knownMatches(matches);const next=clone(store);
  for (const id of incoming.saved) if (!next.saved.includes(id)) next.saved.push(id);
  if (next.saved.length>MAX_PERSONAL) throw new Error('Private bookmark limit reached');
  for (const [id,note] of Object.entries(incoming.notes)) if (!Object.hasOwn(next.notes,id)) next.notes[id]=note;
  if (Object.keys(next.notes).length>MAX_PERSONAL) throw new Error('Private note limit reached');
  for (const [id,entry] of Object.entries(incoming.entries)) {
    if (Object.hasOwn(next.entries,id)) continue;
    // Entries are personal references only. Unknown or changed fixtures remain detached.
    const match=known.get(id);
    if (entry.predictedScore&&Date.parse(entry.predictedAt)>=Date.parse(entry.fixture.startTime)) throw new Error('Post-start private score is invalid');
    if (match&&entryState(entry,match,nowAt)==='locked'&&Date.parse(entry.predictedAt)>=Date.parse(entry.fixture.startTime)) throw new Error('Post-start private score is invalid');
    next.entries[id]=clone(entry);
  }
  if (Object.keys(next.entries).length>MAX_ENTRIES) throw new Error('Private entry limit reached');
  if (pristine(store)) next.settings=clone(incoming.settings);
  else for (const [id,adjustment] of Object.entries(incoming.settings.adjustments)) if (!Object.hasOwn(next.settings.adjustments,id)) next.settings.adjustments[id]=adjustment;
  if (Object.keys(next.settings.adjustments).length>MAX_PERSONAL) throw new Error('Private adjustment limit reached');
  assertStore(next);return next;
}
