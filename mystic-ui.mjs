const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const APPROVED_SOURCE_HOSTS=new Set([
 'lolesports.com','na.leagueoflegends.com','www.leagueoflegends.com','ge.globo.com'
]);

function trustedUrl(value){
 try{
  const url=new URL(String(value));
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&APPROVED_SOURCE_HOSTS.has(url.hostname.toLowerCase())?url.href:null;
 }catch{return null;}
}

function sourceMarkup(source,icon){
 const title=escapeHtml(source?.title||'來源待補');
 const publisher=escapeHtml(source?.publisher||'出版者待補');
 const type=escapeHtml(source?.type||'歷史資料');
 const checkedAt=escapeHtml(source?.checkedAt||'查核日待補');
 const url=trustedUrl(source?.url);
 const link=url?`<a class="source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${title} ${icon('external')}</a>`:`<span class="mystic-source-disabled">${title}</span>`;
 return `<footer class="mystic-card-source">${link}<span>${publisher} · ${type} · 查核 ${checkedAt}</span></footer>`;
}

function quoteActions({lane,card,quoteStatus}){
 const enabled=quoteStatus?.enabled===true;
 const reason=escapeHtml(quoteStatus?.reason||'目前無法引用到私人賽前草稿。');
 const identity=`data-evidence-lane="${escapeHtml(lane)}" data-evidence-id="${escapeHtml(card?.id||'')}"`;
 return `<div class="mystic-quote-actions"><span class="mystic-quote-hint">${enabled?'只加入理由草稿，尚未儲存。':reason}</span><div><button class="button secondary" data-quote-stance="support" ${identity} ${enabled?'':'disabled'}>引用為支持</button><button class="button secondary" data-quote-stance="counter" ${identity} ${enabled?'':'disabled'}>引用為反例</button></div></div>`;
}

function cardMarkup(card,icon,lane,quoteStatus){
 if(!card)return '';
 const year=Number.isInteger(card.year)?String(card.year):'歷史';
 const applies=escapeHtml(card.applies||'適用範圍待確認');
 return `<article class="mystic-evidence-card">
  <div class="mystic-card-head"><span class="mystic-year">${year}</span><span class="mystic-scope">${escapeHtml(card.scopeLabel||'歷史脈絡')}</span></div>
  <h4>${escapeHtml(card.title||'未命名案例')}</h4>
  <p class="mystic-fact"><b>已知事實</b>${escapeHtml(card.fact||'尚無足夠資料。')}</p>
  <p class="mystic-interpretation"><b>這場怎麼看</b>${escapeHtml(card.interpretation||'只作觀賽脈絡，不延伸為預測。')}</p>
  <details class="mystic-counter"><summary>適用範圍與反例</summary><p><b>適用方式：</b>${applies}</p><p><b>保留條件：</b>${escapeHtml(card.limitation||'不同年份與陣容不能直接類推。')}</p></details>
  ${sourceMarkup(card.source,icon)}
  ${quoteActions({lane,card,quoteStatus})}
 </article>`;
}

function laneMarkup({lane,label,title,description,cards,empty,icon,quoteStatus}){
 return `<section class="mystic-lane">
  <div class="mystic-lane-heading"><span class="tiny-label">${escapeHtml(label)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>
  ${cards?.length?`<div class="mystic-evidence-grid">${cards.map(card=>cardMarkup(card,icon,lane,quoteStatus)).join('')}</div>`:`<div class="mystic-empty-lane">${escapeHtml(empty)}</div>`}
 </section>`;
}

function scoreMarkup({assessment,match}){
 const score=assessment?.score;
 if(!assessment?.pregame||!score){
  return `<div class="mystic-score unavailable"><span>${escapeHtml(assessment?.unavailableReason||'這場不再建立新的賽前玄學比分。')}</span><small>歷史脈絡仍可閱讀；它不會回填或改寫任何預測。</small></div>`;
 }
 const side=Number.isInteger(score.side)&&match?.teams?.[score.side]?match.teams[score.side].code:'TBD';
 return `<div class="mystic-score"><span>玄學比分劇本 · ${escapeHtml(side)} ${match.bestOf===1?'單局獲勝':'系列賽獲勝'}</span><strong>${escapeHtml(score.a)} : ${escapeHtml(score.b)}</strong><small>${escapeHtml(assessment.scoreReason||'主觀敘事，不提供機率。')}</small></div>`;
}

function miniMarkup({assessment,match,icon}){
 const recent=assessment?.recent?.[0];
 const detail=recent?`${recent.title}：${recent.interpretation}`:assessment?.missingTeams?.length?'這組對局缺少可直接套用的隊史資料。':'用歷史與近期官方賽果，拆開看每種故事的邊界。';
 return `<section class="panel mystic-mini mystic-panel"><span class="tiny-label purple">HISTORY × INTUITION</span><h3>這場，也有另一種劇本。</h3>${scoreMarkup({assessment,match})}<p class="mystic-mini-copy">${escapeHtml(detail)}</p><p class="mystic-limit">玄學不改變專業模型、Elo 或 Key Player 評估。</p><button class="text-button" data-tab="mystic">查看歷史脈絡 ${icon('arrow')}</button></section>`;
}

export function mysticView({assessment,match,theme,themes,mini=false,icon,quoteStatus}={}){
 if(mini)return miniMarkup({assessment,match,icon});
 const missing=assessment?.missingTeams?.length?`目前沒有 ${assessment.missingTeams.map(escapeHtml).join('、')} 的可直接套用隊史；不以同賽區隊伍冒充隊史。`:'';
 const pacTeams=match?.teams?.filter(team=>team?.region==='PAC'&&team?.code&&team.code!=='TBD').map(team=>escapeHtml(team.code))||[];
 const pacNotice=pacTeams.length?`${pacTeams.join('、')} 的官方賽區標示為 PAC。PAC 是寬泛賽區，本站不把越南、台灣或其他隊伍的歷史移植給它。`:'';
 return `<section class="panel analysis-content mystic-panel mystic-full">
  <div class="mystic-intro"><span class="tiny-label purple">HISTORY × INTUITION</span><h3>玄學評估：先辨識故事，再判斷它能不能套用。</h3><p>把賽區記憶、同一組織的舊陣容、世界賽特殊劇本與本屆賽果拆開。所謂「外戰外行」只是需要檢驗的舊印象，不能當成隊伍的永久標籤。</p></div>
  <div class="theme-switch" role="group" aria-label="玄學主題">${Object.entries(themes||{}).map(([id,item])=>`<button class="button ${id===theme?.id?'selected':''}" data-theme="${escapeHtml(id)}" aria-pressed="${id===theme?.id}">${escapeHtml(item.label)}</button>`).join('')}</div>
  <section class="mystic-theme-summary"><div><span class="tiny-label">SELECTED STORY</span><h4>${escapeHtml(theme?.title||'歷史脈絡')}</h4><p>${escapeHtml(theme?.text||'選擇一個觀賽角度。')}</p></div>${scoreMarkup({assessment,match})}</section>
  <p class="mystic-limit">${escapeHtml(theme?.limit||'玄學只作主觀敘事。')} 不提供機率，也不會調整 Elo、比分分布或 Key Player 評估。</p>
  ${missing?`<p class="mystic-missing">${missing}</p>`:''}${pacNotice?`<p class="mystic-missing">${pacNotice}</p>`:''}
  ${laneMarkup({lane:'team',label:'TEAM EXPERIENCE',title:'隊伍經歷',description:'只收同一組織的歷史，且明確標示它屬於舊陣容。',cards:assessment?.team,empty:'尚無可核實、可直接套用的同組織國際賽／世界賽經歷。',icon,quoteStatus})}
  ${laneMarkup({lane:'region',label:'REGION MEMORY',title:'賽區記憶',description:'這是同賽區的類比，不是目前隊伍的成績或天賦。',cards:assessment?.region,empty:'尚無適合的賽區類比；不強行替未知來源的隊伍加上區域故事。',icon,quoteStatus})}
  ${laneMarkup({lane:'worlds',label:'WORLDS STORY',title:'世界賽特殊劇本',description:'世界賽共同記憶可啟發提問，但不會替當前陣容累積勝率。',cards:assessment?.worlds,empty:'尚無對應的世界賽故事。',icon,quoteStatus})}
  ${laneMarkup({lane:'recent',label:'THIS TOURNAMENT',title:'本屆賽果脈絡',description:'只列此次開賽前已確認的官方結果；再戰時同時保留延續與復仇兩種解讀。',cards:assessment?.recent,empty:'開賽前沒有可用的本屆官方賽果。',icon,quoteStatus})}
 </section>`;
}
