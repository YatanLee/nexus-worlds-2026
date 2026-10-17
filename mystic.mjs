import {MYSTIC_CASES} from './mystic-data.mjs';
import {predictionAvailability,SOURCE,timeTW} from './schedule.mjs';

const THEMES=new Set(['underdog','legacy','momentum']);
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const known=team=>team&&typeof team.id==='string'&&/^\d{10,24}$/.test(team.id)&&team.code!=='TBD';
const label=match=>match.teams.map(team=>team.code).join(' vs ');
const terminal=match=>[1,3,5].includes(match?.bestOf)&&Array.isArray(match.teams)&&match.teams.length===2&&match.teams.every(team=>known(team)&&Number.isInteger(team.wins)&&team.wins>=0&&team.wins<=(match.bestOf+1)/2)&&match.teams[0].id!==match.teams[1].id&&match.teams.filter(team=>team.wins===(match.bestOf+1)/2).length===1;
const winner=match=>match.teams.find(team=>team.wins===(match.bestOf+1)/2).id;

function caseCard(item,scopeLabel,applies){
 return {id:item.id,title:item.title,year:item.year,scopeLabel,fact:item.fact,interpretation:item.interpretation,limitation:item.limitation,applies,source:{...item.source}};
}

// Only results actually observed before the selected fixture may inform a scenario.
// This is a live reading aid, not a reconstruction of an archived pregame prediction.
function priorResults(match,matches,cutoff){
 return matches.filter(row=>row?.id!==match.id&&row?.state==='completed'&&terminal(row)&&validTime(row.startTime)&&validTime(row.observedAt)&&Date.parse(row.startTime)<Date.parse(row.observedAt)&&Date.parse(row.observedAt)<cutoff&&Date.parse(row.startTime)<cutoff&&cutoff-Date.parse(row.startTime)<=30*86400000)
  .sort((a,b)=>Date.parse(b.startTime)-Date.parse(a.startTime)||String(a.id).localeCompare(String(b.id)));
}

export function mysticAssessment(match,matches=[],professionalBaseline=null,theme='underdog',now=Date.now()){
 theme=THEMES.has(theme)?theme:'underdog';
 const teams=Array.isArray(match?.teams)?match.teams.filter(known):[];
 const start=validTime(match?.startTime)?Date.parse(match.startTime):NaN;
 const cutoff=Number.isFinite(start)&&Number.isFinite(+now)?Math.min(start,+now):NaN;
 const result={theme,cutoff:Number.isFinite(cutoff)?new Date(cutoff).toISOString():null,pregame:false,score:null,scoreReason:'',unavailableReason:'對戰或賽前資料不足，暫不寫比分劇本。',team:[],region:[],worlds:[],recent:[],missingTeams:[]};
 for(const team of teams){
  const direct=MYSTIC_CASES.find(item=>item.teamId===team.id);
  if(direct)result.team.push(caseCard(direct,'同組織隊史 · 舊陣容',`${team.code} 的組織 ID 符合此案例；不代表本屆陣容延續。`));
  else result.missingTeams.push(team.code);
  const regional=MYSTIC_CASES.find(item=>item.regions?.includes(team.region)&&item.id!==direct?.id);
  if(regional)result.region.push(caseCard(regional,'賽區類比 · 非本隊成績',`${team.code} 的官方賽區為 ${team.region}；只借用歷史賽區記憶，沒有推定國籍、主場或打法。`));
 }
 result.region=result.region.filter((card,index,all)=>all.findIndex(other=>other.id===card.id)===index);
 const storyIds=theme==='legacy'?['t1-2023','tpa-2012']:theme==='momentum'?['drx-2022','t1-2023']:['drx-2022','tpa-2012'];
 result.worlds=storyIds.map(id=>caseCard(MYSTIC_CASES.find(item=>item.id===id),'世界賽劇本 · 跨隊類比','提供觀賽靈感，並非當前隊伍的經歷或可比樣本。'));
 if(!match||teams.length!==2||teams[0].id===teams[1].id||!Number.isFinite(cutoff))return result;
 const prior=priorResults(match,Array.isArray(matches)?matches:[],cutoff);
 const rematch=prior.find(row=>teams.every(team=>row.teams.some(other=>other.id===team.id)));
 const latest=teams.map(team=>prior.find(row=>row.teams.some(other=>other.id===team.id)));
 const selected=[rematch,...latest].filter(Boolean).filter((row,index,all)=>all.findIndex(other=>other.id===row.id)===index);
 result.recent=selected.map(row=>({id:`result-${row.id}`,title:row===rematch?'再戰：復仇，還是延續？':'本屆最近一次已確認結果',year:new Date(row.startTime).getUTCFullYear(),scopeLabel:'本屆官方賽果 · 依隊伍 ID',
  fact:`${timeTW(row.startTime)}（台灣時間）· ${label(row)} ${row.teams.map(team=>team.wins).join('：')} · BO${row.bestOf}。`,
  interpretation:row===rematch?'同一結果可以支持「再贏一次」，也可以激發「復仇改寫」；兩個故事都不是必然。':'可觀察勝後延續或敗後調整；沒有即時士氣、更衣室或選手心理資料。',
  limitation:'只顯示開賽前已觀察到的近期結果；單場勝負不代表固定剋制，分頁缺漏也可能讓樣本不完整。',
  applies:`此結果在 ${timeTW(row.observedAt)}（台灣時間）已由來源確認；不會用本場結果回填劇本。`,
  source:{title:'Riot Worlds 官方賽程',url:SOURCE,publisher:'Riot Games',checkedAt:row.observedAt,type:'官方每日快照'}
 }));
 result.pregame=predictionAvailability(match,now)==='ready'&&Boolean(professionalBaseline)&&Number.isFinite(professionalBaseline.win)&&professionalBaseline.win>=0&&professionalBaseline.win<=1&&[1,3,5].includes(match.bestOf);
 if(!result.pregame){result.unavailableReason='已開始、已結束、對戰待定或資料不足時，只閱讀歷史，不生成新的賽前劇本；這裡不是賽前封存。';return result;}
 let chosen=null;
 if(theme==='underdog'){
  if(Math.abs(professionalBaseline.win-.5)<1e-10)result.unavailableReason='專業基準為五五波，沒有明確弱勢方；不任選一隊扮演黑馬。';
  else {chosen=teams[professionalBaseline.win<.5?0:1].id;result.scoreReason='選擇未調整 Elo 基準較弱勢的一方，想像打滿逆襲；歷史故事不代表本場會讓二追三。';}
 }else if(theme==='legacy'){
  const direct=teams.filter(team=>MYSTIC_CASES.some(item=>item.teamId===team.id));
  if(direct.length===1){chosen=direct[0].id;result.scoreReason='借用唯一已核實的同組織隊史，寫下長局獲勝的故事；舊陣容成績不作能力加成。';}
  else if(rematch){chosen=winner(rematch);result.scoreReason='雙方的大賽歷史沒有單一方向，改以本屆前次交手勝方延續記憶，想像這次打滿獲勝。';}
  else result.unavailableReason='隊史資料無法支持單一方向，保留故事，不任選比分。';
 }else{
  const winning=teams.filter((team,index)=>latest[index]&&winner(latest[index])===team.id);
  if(latest.every(Boolean)&&winning.length===1){chosen=winning[0].id;result.scoreReason='雙方最近一次對局皆已確認；替其中獲勝的一方寫下延續勝勢的劇本，這不是士氣測量。';}
  else result.unavailableReason='近期結果不足，或雙方同為勝／負，沒有單一氣勢方向，暫不寫比分。';
 }
 if(chosen!==null){const side=teams.findIndex(team=>team.id===chosen),target=(match.bestOf+1)/2;result.score={side,a:side===0?target:target-1,b:side===1?target:target-1};result.unavailableReason='';}
 return result;
}
