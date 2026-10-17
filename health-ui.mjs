const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const n=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const pct=value=>typeof value==='number'&&Number.isFinite(value)?`${(value*100).toFixed(1)}%`:'資料未滿 20 場';
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)):'尚無';
const score=value=>typeof value==='number'&&Number.isFinite(value)?value.toFixed(3):'資料未滿 20 場';
const reasonLabel={
  'fixture-changed':'賽程／對手／BO 已異動',
  'fixture-missing':'官方賽程暫缺此場',
  'identity-mismatch':'隊伍身分無法對照',
  'result-missing':'官方結果尚未完整確認'
};

export function healthFilterOptions(health){
  const groups=Array.isArray(health?.groups)?health.groups:[];
  return {models:[...new Set(groups.map(group=>group?.modelVersion).filter(value=>typeof value==='string'))],bestOf:[...new Set(groups.map(group=>String(group?.bestOf)).filter(value=>['all','1','3','5'].includes(value)))]};
}

function selectedGroup(health,modelVersion,bestOf){
  const groups=Array.isArray(health?.groups)?health.groups:[];
  return groups.find(group=>group?.modelVersion===modelVersion&&String(group?.bestOf)===String(bestOf))||null;
}

function metric(label,value,detail=''){
  return `<article class="health-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</article>`;
}

export function modelHealthView(health,{modelVersion='',bestOf='all'}={}){
  if(!health||health.schemaVersion!==1||!Array.isArray(health.groups))return `<section class="panel health-empty"><span class="tiny-label">MODEL HEALTH</span><h2>健康度資料暫時無法讀取</h2><p>賽程與賽前封存仍可瀏覽；本頁不以目前資料自行補算歷史成績。</p></section>`;
  const options=healthFilterOptions(health);
  const model=options.models.includes(modelVersion)?modelVersion:options.models[0]||'';
  const bo=options.bestOf.includes(String(bestOf))?String(bestOf):'all';
  const group=selectedGroup(health,model,bo);
  if(!group)return `<section class="panel health-empty"><span class="tiny-label">MODEL HEALTH</span><h2>尚無可評估的模型分組</h2><p>公開賽前封存建立後，才會在這裡統計官方賽果。</p></section>`;
  const counts=group.counts||{},exact=group.exact||{},direction=group.direction||{},probability=group.probability||{};
  const reasons=Object.entries(group.reasons||{}).filter(([,count])=>n(count)>0);
  const enough=n(exact.denominator)>=20&&n(direction.denominator)>=20&&n(probability.denominator)>=20;
  const coverage=`${date(group.period?.from)} 至 ${date(group.period?.to)}`;
  return `<div class="health-page"><section class="health-hero panel"><div><span class="tiny-label">MODEL HEALTH · EXPLORATORY</span><h2>用賽後結果，檢查模型有沒有跟上。</h2><p>僅使用可驗證的公開賽前封存；同場採最後一份合格基準。所有比例與誤差都是探索性結果。</p></div><div class="health-filters" aria-label="模型健康度篩選"><label>模型<select id="health-model">${options.models.map(value=>`<option value="${esc(value)}" ${value===model?'selected':''}>${esc(value)}</option>`).join('')}</select></label><label>賽制<select id="health-bo">${['all','1','3','5'].filter(value=>options.bestOf.includes(value)).map(value=>`<option value="${value}" ${value===bo?'selected':''}>${value==='all'?'全部 BO':`BO${value}`}</option>`).join('')}</select></label></div></section><section class="health-summary"><div class="health-metrics">${metric('官方對局',n(counts.official),'此分組已納入的官方賽程')}${metric('已驗證',n(counts.verified),'可列入相應分母')}${metric('未封存',n(counts.noBaseline),`已結束 ${n(counts.completedNoBaseline)} 場，不回填預測`) }${metric('不可驗證',n(counts.unverified),'賽程版本不同')}</div><p class="health-coverage">涵蓋期間：${esc(coverage)} · 模型：${esc(group.modelVersion)} · 分組：${bo==='all'?'所有賽制':`BO${bo}`}</p></section><section class="health-grid"><article class="panel health-card"><span class="tiny-label">EXACT SCORE</span><h3>${pct(exact.rate)}</h3><p>${n(exact.hits)} 命中 / ${n(exact.denominator)} 個唯一最高比分可評估對局</p><small>並列最高比分 ${n(exact.tiedTopExcluded)} 場另列，不混入單一比分命中率。</small></article><article class="panel health-card"><span class="tiny-label">WINNER DIRECTION</span><h3>${pct(direction.rate)}</h3><p>${n(direction.hits)} 命中 / ${n(direction.denominator)} 個有方向預測對局</p><small>五五波 ${n(direction.evenExcluded)} 場不計方向命中；仍可納入機率誤差。</small></article><article class="panel health-card"><span class="tiny-label">PROBABILITY ERROR</span><h3>${score(probability.brier)}</h3><p>Brier score · 分母 ${n(probability.denominator)}</p><small>${probability.infinite?'有零機率的實際比分，log loss 為無限大。':'分母未滿 20 場時不顯示匯總誤差。'}</small></article><article class="panel health-card"><span class="tiny-label">EXACT-SCORE LOG LOSS</span><h3>${probability.infinite?'∞':score(probability.logLoss)}</h3><p>精確比分 log loss · 分母 ${n(probability.denominator)}</p><small>${enough?'達到門檻，仍屬探索性結果。':'各相關分母達 20 場才顯示。'}</small></article></section><section class="panel health-reasons"><div><span class="tiny-label">VALIDATION GAPS</span><h3>不能計分的原因</h3><p>待官方結果：${n(counts.pending)} 場。完成但沒有合格基準：${n(counts.completedNoBaseline)} 場。</p></div>${reasons.length?`<ul>${reasons.map(([reason,count])=>`<li><span>${esc(reasonLabel[reason]||'未分類的驗證缺口')}</span><b>${n(count)}</b></li>`).join('')}</ul>`:'<p class="muted small">目前沒有已分類的不可驗證紀錄。</p>'}</section><details class="panel health-method"><summary>指標怎麼看？</summary><p>精確比分只評估唯一最高機率的比分；並列時不強迫選一個。勝方方向只評估非五五波預測。Brier score 衡量封存系列賽勝率和實際勝方的平方誤差；精確比分 log loss 衡量封存機率分布對實際比分的機率懲罰。兩項機率誤差可包含並列與五五波，卻不會把它們變成方向或精確比分命中。</p></details></div>`;
}
