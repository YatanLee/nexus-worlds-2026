// Public-ledger display helpers. They only render data read from the local API.
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const score=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isInteger)?`${value[0]} : ${value[1]}`:Number.isInteger(value?.a)&&Number.isInteger(value?.b)?`${value.a} : ${value.b}`:'—';
const time=value=>{
  if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return '時間未提供';
  return new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
};
function winnerText(baseline){
  const codes=Array.isArray(baseline?.teamCodes)?baseline.teamCodes:[];
  const win=baseline?.win;
  if(typeof win==='number'&&Number.isFinite(win)&&codes.length===2){
    if(Math.abs(win-.5)<1e-10)return '勢均力敵，不計入方向命中';
    return `${esc(codes[win>.5?0:1])} 勝方傾向`;
  }
  if(typeof win==='string'&&codes.includes(win))return `${esc(win)} 勝方傾向`;
  if(win?.side===0||win?.side===1)return `${esc(codes[win.side]||'—')} 勝方傾向`;
  return '未提供方向傾向';
}
function auditLink(runId){
  return typeof runId==='string'&&/^\d{1,20}$/.test(runId)||typeof runId==='number'&&Number.isSafeInteger(runId)&&runId>0
    ?`<a class="history-audit" href="https://github.com/YatanLee/nexus-worlds-2026/actions/runs/${encodeURIComponent(String(runId))}" target="_blank" rel="noopener noreferrer">查看 CI 稽核紀錄 ↗</a>`
    :'';
}
const historyLink='<a class="history-audit" href="https://github.com/YatanLee/nexus-worlds-2026/blob/main/data/prediction-history.json" target="_blank" rel="noopener noreferrer">查看公開歷史版本 ↗</a>';
function retainedNotice(syncStatus){
  return syncStatus?.ok===false?'<p class="history-retained">公開歷史同步這次未成功；畫面保留最後一次成功讀取的公開紀錄。</p>':'';
}
function revisionPolicy(evaluation){
  const count=Number.isSafeInteger(evaluation?.revisionCount)&&evaluation.revisionCount>0?`同場同模型共 ${evaluation.revisionCount} 份紀錄`:'同場同模型保留所有版本';
  return `<p class="history-policy">採用最後一份合格賽前封存；${count}。${historyLink}</p>`;
}
function verdict(label,value){
  if(value===true)return `<span class="history-verdict hit">${esc(label)}命中</span>`;
  if(value===false)return `<span class="history-verdict miss">${esc(label)}未命中</span>`;
  return `<span class="history-verdict neutral">${esc(label)}不適用</span>`;
}
export function historyHint(evaluation, unavailable=false,syncStatus=null){
  if(unavailable)return '<p class="history-hint unavailable">賽前封存紀錄暫時無法讀取；賽程仍可正常瀏覽。</p>';
  if(syncStatus?.ok===false)return '<p class="history-hint retained">公開歷史同步未成功，保留最後成功讀取的紀錄。</p>';
  if(!evaluation)return '<p class="history-hint">尚無公開賽前封存紀錄；本站不以現在資料回填過去預測。</p>';
  if(evaluation.status==='no-baseline')return '<p class="history-hint">此場尚未封存賽前預測。</p>';
  if(evaluation.status==='unverified')return '<p class="history-hint">封存紀錄待驗證：賽程、對手或 BO 已變動。</p>';
  if(evaluation.reason==='result-revision-pending'||evaluation.reason==='official-result-not-final')return '<p class="history-hint">賽前基準已封存；來源賽果尚待公開修訂確認，不計入統計。</p>';
  return '<p class="history-hint verified">此場有可追溯的公開賽前基準。</p>';
}
export function historyCard(match,evaluation,{unavailable=false,syncStatus=null}={}){
  if(unavailable)return `<section class="history-card panel unavailable" aria-live="polite"><span class="tiny-label">PUBLIC PRE-GAME LEDGER</span><h3>賽前封存紀錄暫時無法讀取</h3><p>不會以目前的 Elo 或情境滑桿重建過去預測；可稍後重試本機資料同步。</p></section>`;
  if(!evaluation||evaluation.status==='no-baseline')return `<section class="history-card panel"><span class="tiny-label">PUBLIC PRE-GAME LEDGER</span><h3>未封存賽前預測</h3><p>${match.state==='completed'?'此場沒有合格的公開賽前基準，不做回溯預測或命中判定。':'本場尚無符合「開賽前超過 10 分鐘、賽程與戰力重新確認」的公開基準。'}</p>${match.state==='completed'?`<strong class="history-actual">官方結果 ${esc(score(match.teams.map(team=>team.wins)))}</strong>`:'<p class="small muted">正式紀錄僅由 GitHub CI 建立；本機與瀏覽器只讀取。</p>'}${retainedNotice(syncStatus)}</section>`;
  const baseline=evaluation.baseline;
  if(!baseline)return `<section class="history-card panel"><span class="tiny-label">PUBLIC PRE-GAME LEDGER</span><h3>封存紀錄格式不完整</h3><p>保留賽程資料，但不顯示無法辨識的過去預測。</p></section>`;
  const candidates=Array.isArray(baseline.top)?baseline.top.filter(row=>Number.isInteger(row?.a)&&Number.isInteger(row?.b)&&Number.isFinite(row?.p)).slice(0,8):[];
  const isDone=match.state==='completed';
  const incompatible=evaluation.status==='unverified';
  const revisionPending=evaluation.reason==='result-revision-pending'||evaluation.reason==='official-result-not-final';
  const actual=evaluation.actual|| (isDone?match.teams.map(team=>team.wins):null);
  const statusText=incompatible?'賽程變動':`${esc(evaluation.modelVersion||baseline.modelVersion||'模型')} 封存`;
  return `<section class="history-card panel ${incompatible?'unverified':''}"><div class="history-head"><div><span class="tiny-label">PUBLIC PRE-GAME LEDGER</span><h3>${incompatible?'封存預測無法驗證':'賽前公開基準'}</h3></div><span class="history-status ${esc(evaluation.status)}">${statusText}</span></div><p class="history-meta">封存於 ${esc(time(baseline.capturedAt))} · BO${esc(baseline.bestOf)} · ${esc((baseline.teamCodes||[]).join(' vs ')||'隊伍未提供')}</p>${revisionPolicy(evaluation)}${incompatible?`<p class="history-warning">${esc(evaluation.reason||'官方賽程、對手或 BO 與封存時不同。這不是模型失準，不能列入命中統計。')}</p>`:`<div class="history-grid"><div><span>凍結比分候選</span><strong>${candidates.length?candidates.map(row=>`${row.a} : ${row.b}`).join(' ／ '):'未提供'}</strong>${candidates.length?`<small>${candidates.map(row=>`${(row.p*100).toFixed(1)}%`).join(' ／ ')}</small>`:''}</div><div><span>系列賽傾向</span><strong>${winnerText(baseline)}</strong><small>封存隊伍順序：${esc((baseline.teamCodes||[]).join(' · '))}</small></div></div>`}${revisionPending?'<p class="history-warning">本機官方來源賽果與公開修訂尚待對齊，暫不計分。</p>':''}${isDone?`<div class="history-result"><div><span>${revisionPending?'本機官方來源結果（待修訂）':'官方結果'}</span><strong>${esc(score(actual))}</strong></div>${evaluation.status!=='verified'?'':`<div class="history-verdicts">${verdict('精確比分',evaluation.exactHit)}${verdict('勝方方向',evaluation.winnerHit)}</div>`}</div>`:`<p class="history-pending">等待官方賽果。公開紀錄不會隨本機情境滑桿改變。</p>`}${retainedNotice(syncStatus)}${auditLink(baseline.runId||evaluation.runId)}</section>`;
}
