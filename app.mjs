import { FIXTURES, FACTORS, PRESETS, SOURCES, STAGES, STORIES } from './data.mjs';
import { markets, implied, validateMatch } from './model.mjs';

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = p => p == null ? '—' : `${(p*100).toFixed(1)}%`;
const icon = (name,cls='') => {
  const paths = { home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z', chart:'M4 20V12m8 8V4m8 16V8', book:'M5 3h14v18H5zM8 8h8M8 12h8M8 16h5', database:'M4 6c0-5 16-5 16 0s-16 5-16 0Zm0 0v12c0 5 16 5 16 0V6M4 12c0 5 16 5 16 0', arrow:'m9 5 7 7-7 7', plus:'M12 5v14M5 12h14', save:'M6 3h12v18l-6-4-6 4Z', close:'m6 6 12 12M6 18 18 6', download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4', search:'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 6 6', spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z', crown:'m3 6 4 5 5-8 5 8 4-5-2 14H5Z', moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z', check:'m5 12 4 4L19 6', info:'M12 11v6m0-10v1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', external:'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7', tune:'M4 7h16M4 17h16M8 3v8m8 2v8', trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7' };
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
};
const storageKey='nexus-worlds-v1';
let storageOK=true, initial={};
try { initial=JSON.parse(localStorage.getItem(storageKey)||'{}')||{}; } catch { storageOK=false; }
let matches=FIXTURES.map(x=>({...x,scores:[...x.scores]}));
for(const m of (Array.isArray(initial.custom)?initial.custom.slice(0,30).map(validateMatch).filter(Boolean):[])) {
  const index=matches.findIndex(x=>x.id===m.id);
  if(index>=0) matches[index]=m; else matches.push(m);
}
const state={ view:'home',stage:'all',search:'',selected:matches[0].id, tab:'pro', preset:'balanced',market:'winner',pick:0,total:3.5, odds:Object.create(null), scores:Object.create(null), saved:[], notes:Object.create(null) };
if(Array.isArray(initial.saved)) state.saved=initial.saved.slice(0,100).filter(x=>x && typeof x.id==='string' && typeof x.label==='string' && typeof x.matchLabel==='string' && typeof x.marketLabel==='string' && Number.isFinite(x.odds) && x.odds>1 && x.odds<=1000 && (x.probability===null || (Number.isFinite(x.probability)&&x.probability>=0&&x.probability<=1))).map(x=>({id:x.id.slice(0,100),label:x.label.slice(0,120),matchLabel:x.matchLabel.slice(0,120),marketLabel:x.marketLabel.slice(0,80),odds:x.odds,probability:x.probability,created:String(x.created||'').slice(0,40),note:String(x.note||'').slice(0,1000)}));
if(initial.notes && typeof initial.notes==='object') for(const [id,note] of Object.entries(initial.notes).slice(0,100)) {
  if(matches.some(m=>m.id===id) && note && typeof note==='object') state.notes[id]={author:String(note.author||'').slice(0,80),url:safeURL(note.url),text:String(note.text||'').slice(0,3000)};
}
function safeURL(v) { try { const u=new URL(v); return ['http:','https:'].includes(u.protocol)?u.href:''; } catch { return ''; } }
function persist() {
  try { localStorage.setItem(storageKey,JSON.stringify({version:1,custom:matches.filter(m=>m.custom),saved:state.saved,notes:state.notes})); storageOK=true; }
  catch { storageOK=false; toast('本機儲存不可用，請匯出備份；目前資料僅保留至關閉頁面。'); }
}
let toastTimer;
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3800); }
function current() { return matches.find(m=>m.id===state.selected)||matches[0]; }
function analysis() { const m=current(); return markets(m,state.scores[m.id]||m.scores,state.preset,state.total); }
function currentMarket() { return analysis().list.find(m=>m.key===state.market)||analysis().list[0]; }
function oddsKey(){ return `${current().id}-${state.market}-${state.market==='total'?state.total:''}`; }
function marketOdds() { const market=currentMarket(); return state.odds[oddsKey()] || (market.key==='winner'?[...current().odds]:market.options.map(()=>1.9)); }
function route(view,id) {
  state.view=view;
  if(id) {state.selected=id;state.market='winner';state.pick=0;state.total=current().bestOf===5?3.5:2.5;}
  history.replaceState(null,'',view==='home'?'#overview':view==='matches'?`#match=${encodeURIComponent(state.selected)}`:`#${view}`);
  render(); window.scrollTo({top:0,behavior:'smooth'});
}
function shell() {
  return `<aside class="sidebar"><a class="brand" href="#overview" data-nav="home" aria-label="NEXUS 首頁"><span class="brand-mark">N</span><b>NEXUS</b><small>賽局研究所</small></a>
  <nav aria-label="主選單">${[['home','home','總覽'],['matches','chart','賽事預測'],['watchlist','book','我的觀察'],['methods','database','資料與方法']].map(([v,i,t])=>`<button class="nav-item ${state.view===v?'active':''}" data-nav="${v}">${icon(i)}<span>${t}</span>${v==='watchlist'&&state.saved.length?`<em>${state.saved.length}</em>`:''}</button>`).join('')}</nav>
  <div class="local-box">${icon('database')}<div><b>${storageOK?'本機儲存空間':'儲存受限'}</b><small>${state.saved.length} 筆觀察 · ${storageOK?'僅此瀏覽器':'請匯出備份'}</small></div><i class="status-dot"></i></div></aside>
  <div class="workspace"><header class="topbar"><a href="#overview" data-nav="home" class="mobile-brand">N<span>NEXUS</span></a><div class="event-brand"><strong>Worlds 2026</strong><span>WORLD CHAMPIONSHIP</span></div><button class="top-method" data-nav="methods">${icon('database')}<span>資料與方法</span></button><div class="mode"><span><i class="status-dot"></i> 示範資料模式</span><small>非即時賽程／賠率</small></div></header><main id="main" tabindex="-1">${state.view==='home'?home():state.view==='matches'?matchView():state.view==='watchlist'?watchlist():methods()}</main>
  <footer><span>NEXUS © 2026 · 獨立賽事研究工具</span><span>未滿 18 歲不得購買運動彩券 · 理性觀賽，量力而為</span></footer></div>`;
}
function title(heading,sub,action='') { return `<div class="page-title"><div><h1>${heading}</h1><p>${sub}</p></div>${action}</div>`; }
function notice() { return `<div class="data-notice">${icon('info')}<span>情境對戰與盤口均為示範，非官方賽程、實際賠率或真人分析師意見。玩法依台灣運彩分類，開賣狀態未確認。</span></div>`; }
function home() {
  return `${title('看懂賽局，再相信直覺。','結合專業判讀與歷史玄學，從兩種視角，探索 2026 世界大賽。')}
  <section class="hero" aria-label="2026 英雄聯盟世界賽"><div class="hero-content"><h2>WORLDS 2026</h2><p><span></span>專業判讀 <i>×</i> 歷史玄學</p><button class="button primary" data-nav="matches">探索賽事 ${icon('arrow')}</button></div></section>
  ${notice()}<div class="dashboard"><div class="main-column"><section class="panel radar">${radar(3)}</section><section class="panel preview"><div class="section-head"><h2><i></i>賽事分析預覽</h2><div class="segmented"><button data-preview="pro" class="${state.tab!=='mystic'?'selected':''}">專業分析</button><button data-preview="mystic" class="${state.tab==='mystic'?'selected':''}">玄學觀察</button></div></div>${state.tab==='mystic'?storyMini():preview()}<button class="text-button full-analysis" data-match="${esc(current().id)}">查看 ${esc(current().a)} vs ${esc(current().b)} 完整分析 ${icon('arrow')}</button></section></div>
  <aside class="right-column">${perspective()}${savedMini()}<div class="schedule-mini"><span class="tiny-label">官方賽事節點</span><h3>世界賽的下一站</h3><p><i class="status-dot"></i>入圍賽 → 瑞士輪 → 淘汰賽</p><small>美國當地 10/15–11/14<br>台灣時間總決賽：11/15 03:00</small><button class="text-button" data-nav="methods">時程與資料來源 ${icon('arrow')}</button></div></aside></div>`;
}
function radar(limit=100) {
  const filtered=matches.filter(m=>(state.stage==='all'||m.stage===state.stage)&&`${m.a} ${m.b} ${m.nameA} ${m.nameB}`.toLowerCase().includes(state.search.toLowerCase()));
  return `<div class="section-head"><h2><i></i>賽事雷達 <span class="count">${filtered.length}</span></h2><div class="segmented stage-filters" aria-label="賽事階段">${Object.entries(STAGES).map(([k,v])=>`<button data-stage="${k}" class="${state.stage===k?'selected':''}" aria-pressed="${state.stage===k}">${v}</button>`).join('')}</div></div>
  ${state.view==='matches'?`<div class="radar-tools"><label class="search">${icon('search')}<input id="search" aria-label="搜尋隊伍" placeholder="搜尋隊伍，例如 T1、C9" value="${esc(state.search)}"></label><button class="button secondary" id="new-match">${icon('plus')}自訂對戰</button></div>`:''}
  <div class="match-list">${filtered.slice(0,limit).map(m=>matchRow(m)).join('')||`<div class="empty">${icon('search')}<h3>這個篩選還沒有對戰</h3><p>換個階段或隊名，重新看看賽局。</p><button class="text-button" id="clear-filters">清除篩選</button></div>`}</div>`;
}
function matchRow(m) {
  return `<article class="match-row ${state.view==='matches'&&state.selected===m.id?'current':''}"><div class="match-meta"><small>情境 ${m.custom?'自訂':'示範'}</small><strong>時間待確認</strong><span>${STAGES[m.stage]} · BO${m.bestOf}</span></div><div class="teams"><div class="team"><span class="team-mark" style="--team:${m.colorA}">${esc(m.a)}</span><div><b>${esc(m.a)}</b><small>${esc(m.nameA)}</small></div></div><span class="versus">VS</span><div class="team"><span class="team-mark" style="--team:${m.colorB}">${esc(m.b)}</span><div><b>${esc(m.b)}</b><small>${esc(m.nameB)}</small></div></div></div><div class="row-odds"><small>示範不讓分</small><div>${m.odds.map((o,i)=>`<button class="odds-pill" data-odds-match="${esc(m.id)}" data-side="${i}" aria-label="分析 ${esc(i?m.b:m.a)}，示範賠率 ${o.toFixed(2)}">${o.toFixed(2)}</button>`).join('')}</div></div><button class="open-match" data-match="${esc(m.id)}" aria-label="查看 ${esc(m.a)} 對 ${esc(m.b)} 分析">${icon('arrow')}</button></article>`;
}
function preview() {
  const m=current(),scores=state.scores[m.id]||m.scores;
  return `<p class="small muted preview-context">${esc(m.a)} vs ${esc(m.b)} · 相對評分示範，非戰績百分比</p><div class="preview-bars">${FACTORS.slice(0,3).map(([key,label,desc],i)=>`<div class="preview-row">${icon(i===0?'chart':i===1?'spark':'crown')}<b>${label}</b><span>${desc.split('、')[0]}</span><div class="bar-pair"><i style="width:${scores[i]}%"></i><i style="width:${100-scores[i]}%"></i></div><div><b class="lime">${scores[i]}</b><small class="purple">${100-scores[i]}</small></div></div>`).join('')}</div>`;
}
function storyMini() { const s=STORIES[0]; return `<div class="story-mini">${icon('spark')}<div><small class="purple">${s.tag}</small><h3>${s.title}</h3><p>${s.text}</p><small>歷史敘事 · 不計入模型勝率</small></div></div>`; }
function perspective() {
  return `<section class="perspective panel"><div class="section-head"><h2><i></i>理性與直覺</h2><span class="small muted">雙軌，才看得完整</span></div><div class="perspective-visual"><div><small class="lime">專業視角</small><strong class="lime">數據</strong><span>可調整因子</span></div><div class="ring"><span>×</span></div><div><small class="purple">玄學觀察</small><strong class="purple">敘事</strong><span>歷史與偏見</span></div></div><p>一邊拆解比賽，一邊檢查直覺。<br>歷史故事不等於未來的勝率。</p><button class="perspective-link" data-focus="pro">${icon('chart')}<span><b>專業視角</b><small>評分因子、系列賽模型與盤口比較</small></span>${icon('arrow')}</button><button class="perspective-link mystic" data-focus="mystic">${icon('spark')}<span><b>玄學觀察</b><small>經典劇本、歷史案例與反向思考</small></span>${icon('arrow')}</button></section>`;
}
function savedMini() { return `<section class="panel saved-mini"><div class="section-head"><h2><i></i>我的觀察 <span class="count">${state.saved.length}</span></h2><button class="text-button" data-nav="watchlist">查看全部 ${icon('arrow')}</button></div>${state.saved.length?state.saved.slice(0,2).map(x=>`<div class="saved-peek"><b>${esc(x.label)}</b><small>${esc(x.matchLabel)} · ${esc(x.marketLabel)}</small></div>`).join(''):`<div class="empty small">${icon('save')}<p>還沒有存下任何觀察</p><small>在賽事分析中，留下你的判斷與想法。</small></div>`}</section>`; }
function matchView() {
  const m=current();
  return `${title('賽局，從這裡拆解。','選一場情境對戰，調整分析假設，對照台灣運彩玩法。')}${notice()}<section class="panel radar">${radar()}</section>
  <section class="detail" id="analysis"><div class="detail-heading"><div><span class="tiny-label">MATCH LAB / 情境實驗室</span><h2><span style="color:${m.colorA}">${esc(m.a)}</span> <em>vs</em> <span style="color:${m.colorB}">${esc(m.b)}</span></h2><p>${esc(m.nameA)} × ${esc(m.nameB)} · ${STAGES[m.stage]} · BO${m.bestOf} · 非官方對戰</p></div><button class="button secondary" id="edit-match">${icon('tune')}編輯對戰</button></div>
  <div class="analysis-tabs" role="tablist" aria-label="分析視角">${[['pro','chart','專業分析'],['mystic','spark','玄學觀察'],['notes','book','分析筆記']].map(([k,i,t])=>`<button role="tab" id="tab-${k}" aria-controls="analysis-panel" tabindex="${state.tab===k?0:-1}" aria-selected="${state.tab===k}" class="${state.tab===k?'active':''} ${k==='mystic'?'purple-tab':''}" data-tab="${k}">${icon(i)}${t}</button>`).join('')}</div><div class="analysis-grid"><section class="panel analysis-content" id="analysis-panel" aria-labelledby="tab-${state.tab}" role="tabpanel" tabindex="0">${state.tab==='pro'?proPanel():state.tab==='mystic'?mysticPanel():notesPanel()}</section><aside>${marketPanel()}</aside></div></section>`;
}
function proPanel() {
  const m=current(),model=analysis(),scores=state.scores[m.id]||m.scores;
  return `<div class="section-head"><div><span class="tiny-label lime">PRO ANALYSIS</span><h3>每一個判斷，都有依據。</h3></div><label class="sr-only" for="preset">分析流派</label><select id="preset">${Object.entries(PRESETS).map(([k,v])=>`<option value="${k}" ${state.preset===k?'selected':''}>${v.label}</option>`).join('')}</select></div>
  <div class="probability-head"><div><span>${esc(m.a)} 系列賽模型值</span><strong class="lime" id="win-value">${pct(model.win)}</strong></div><div class="opponent-prob"><span>${esc(m.b)}</span><strong id="lose-value">${pct(1-model.win)}</strong></div></div><div class="probability-bar"><i id="win-bar" style="width:${model.win*100}%"></i></div><p class="small muted">由示範評分推導，未經回測或校準；不是真實預測勝率。</p>
  <div class="factor-legend"><span>← 偏向 ${esc(m.b)}</span><span>50 = 均衡</span><span>偏向 ${esc(m.a)} →</span></div><div class="factors">${FACTORS.map(([key,label,desc],i)=>`<label class="factor" for="factor-${i}"><div><b>${label}</b><small>${desc}</small></div><input type="range" id="factor-${i}" data-factor="${i}" min="0" max="100" value="${scores[i]}" aria-valuetext="${esc(m.a)} 相對評分 ${scores[i]}，50 為均衡"><output id="factor-value-${i}">${scores[i]}</output></label>`).join('')}</div>
  <div class="factor-footer"><small>手動假設，非實測戰績。評分／賠率調整限本次頁面。</small><button class="text-button" id="reset-scores">重設評分</button></div><details class="method-detail"><summary>這個模型怎麼算？</summary><p>各因子按流派加權，經 logistic 轉換為單局參數 p。假設各局獨立且 p 固定，枚舉 BO${m.bestOf} 終局比數，計算系列勝負、讓局與總局數。模型未納入選邊、BP、選手異動或局間相關性。</p><p>單局參數：<b id="map-value">${pct(model.p)}</b>。首殺／首龍等事件缺少獨立數據，因此不產生假機率。</p></details><div class="analyst-note">${icon('book')}<p>有分析師的觀點？在「分析筆記」記下作者、原文連結與判斷，與模型並排檢視。本站未串接真人分析師預測。</p><button class="text-button" data-tab="notes">新增筆記 ${icon('arrow')}</button></div>`;
}
function mysticPanel() {
  return `<span class="tiny-label purple">THE OTHER PERSPECTIVE</span><h3>有些劇本，你好像看過。</h3><p class="muted">把歷史當作觀察視角，也把偏見放上檯面。<br>玄學不提供勝率，不影響右側的專業模型。</p><div class="stories">${STORIES.map(s=>`<article class="story"><div class="story-top">${icon(s.icon)}<span>${s.tag}</span><label><input type="checkbox" data-story="${s.id}"> 加入我的敘事</label></div><h4>${s.title}</h4><p>${s.text}</p><span class="story-target">${s.target}</span><details><summary>先看反例與限制</summary><p>${s.limitation}</p></details>${s.source!==null?`<a href="${SOURCES[s.source].url}" target="_blank" rel="noopener noreferrer" class="source-link">歷史出處 ${icon('external')}</a>`:''}</article>`).join('')}</div><p class="small muted">勾選的敘事會隨下一次加入觀察保存；不是經統計驗證的投注訊號。</p>`;
}
function notesPanel() {
  const n=state.notes[current().id]||{};
  return `<span class="tiny-label lime">RESEARCH NOTEBOOK</span><h3>留下觀點，也留下出處。</h3><p class="muted">整理真人分析師預測或自己的判讀，資料只留在這個瀏覽器。</p><form id="note-form" class="form-stack"><label>作者／分析師<input name="author" maxlength="80" placeholder="例如：自己的觀察，或原作者名稱" value="${esc(n.author||'')}"></label><label>原始來源連結<input type="url" name="url" maxlength="2000" placeholder="https://…" value="${esc(n.url||'')}"></label><label>預測方向與理由<textarea name="text" rows="7" maxlength="3000" placeholder="記下投注玩法、方向、支持證據與可能失準的情境。">${esc(n.text||'')}</textarea></label><button class="button primary" type="submit">${icon('save')}儲存分析筆記</button></form>${n.url?`<a class="source-link" href="${esc(safeURL(n.url))}" target="_blank" rel="noopener noreferrer">開啟原始分析 ${icon('external')}</a>`:''}`;
}
function marketPanel() {
  const m=current(),model=analysis(),market=currentMarket(),odds=marketOdds(),fair=implied(odds);
  return `<section class="panel market-panel"><span class="tiny-label">TAIWAN SPORTS LOTTERY</span><h3>對照盤口，看清差異。</h3><p class="small muted">以下賠率為可編輯的情境假設。<br>當場是否開賣：<b class="amber">未確認</b></p><label for="market">研究玩法</label><select id="market">${model.list.map(x=>`<option value="${x.key}" ${state.market===x.key?'selected':''}>${x.label}</option>`).join('')}</select>${state.market==='total'&&m.bestOf===5?`<label for="total-line">總局數界線</label><select id="total-line"><option value="3.5" ${state.total===3.5?'selected':''}>3.5 局</option><option value="4.5" ${state.total===4.5?'selected':''}>4.5 局</option></select>`:''}
  <div class="market-options">${market.options.map((o,i)=>`<div class="market-option ${state.pick===i?'picked':''}"><button class="pick-button" data-pick="${i}" aria-pressed="${state.pick===i}"><span class="radio-dot"></span><b>${esc(o.label)}</b>${state.pick===i?icon('check'):''}</button><div class="odds-edit"><label for="odd-${i}">情境賠率</label><input id="odd-${i}" data-odd="${i}" type="number" min="1.01" max="1000" step="0.01" value="${odds[i].toFixed(2)}" inputmode="decimal"></div><div class="market-stats"><span>模型值 <b class="lime model-prob" data-option="${i}">${pct(o.p)}</b></span><span>損益平衡 <b class="break-even" data-option="${i}">${pct(fair?.raw[i])}</b></span></div></div>`).join('')}</div>
  <div id="market-summary">${marketSummary(market,odds)}</div><button class="button primary save-pick" id="save-pick">${icon('save')}加入我的觀察</button><p class="small muted">僅保存研究紀錄，不會送出投注。<br>同場只保留一個方向，避免當作同場過關。</p><a class="source-link" href="https://www.sportslottery.com.tw/" target="_blank" rel="noopener noreferrer">前往台灣運彩核對 ${icon('external')}</a></section>`;
}
function marketSummary(market,odds) {
  const fair=implied(odds);
  if(!fair) return '<p class="inline-warning">請輸入大於 1、且不超過 1000 的完整賠率。</p>';
  if(market.unavailable) return `<div class="market-insight"><b>事件數據不足，暫不估算</b><p>首殺、首龍、首塔與首巴龍不能由系列勝率推算。你仍可記錄自己的方向。</p></div>`;
  const p=market.options[state.pick]?.p,delta=(p-fair.normalized[state.pick])*100;
  return `<div class="market-insight"><div><span>模型與去水機率差</span><b class="${delta>=0?'lime':'purple'}">${delta>=0?'+':''}${delta.toFixed(1)}<small> pp</small></b></div><p>去水機率 ${pct(fair.normalized[state.pick])}；總隱含機率 ${(100*(1+fair.margin)).toFixed(1)}%。差值只反映目前假設，不表示獲利機會。</p></div>`;
}
function watchlist() {
  return `${title('每個判斷，都值得回看。','收藏研究方向、保留當時假設。只存在本機，沒有實際投注。',`<button class="button secondary" id="export">${icon('download')}匯出備份</button>`)}<div class="watch-toolbar"><span>${state.saved.length} 筆觀察 · 不以示範資料計算命中率</span><label class="button secondary import-label">匯入備份<input type="file" id="import" accept="application/json,.json"></label></div>${state.saved.length?`<div class="watch-grid">${state.saved.map(x=>`<article class="panel watch-card"><div class="section-head"><span class="tiny-label">${esc(x.marketLabel)}</span><button class="icon-button" data-remove="${esc(x.id)}" aria-label="移除 ${esc(x.label)}">${icon('trash')}</button></div><h2>${esc(x.label)}</h2><p>${esc(x.matchLabel)}</p><div class="watch-metrics"><span>情境賠率<b>${x.odds.toFixed(2)}</b></span><span>當時模型值<b class="lime">${pct(x.probability)}</b></span></div>${x.note?`<p class="watch-note">${esc(x.note)}</p>`:''}<small class="muted">${esc(x.created)} · 情境研究紀錄</small></article>`).join('')}</div>`:`<div class="panel empty big-empty">${icon('save')}<h2>把你的第一個判斷留下來。</h2><p>從賽事選擇玩法與方向，加入觀察。<br>你可以隨時匯出備份，或重新比較當時的假設。</p><button class="button primary" data-nav="matches">探索賽事 ${icon('arrow')}</button></div>`}`;
}
function methods() {
  return `${title('有來源，才有判斷。','資料的邊界、模型的假設與世界賽的時間，一次看清楚。')}<div class="methods-layout"><section><div class="panel method-card"><span class="tiny-label lime">DATA TRANSPARENCY</span><h2>目前是研究工具，資料由你掌握。</h2><p>官方賽事階段與玩法分類已於 2026/10/15 查閱。對戰組合、因子、盤口全部是示範，未連接即時資料服務；不包含任何真人分析師共識或經驗證的勝率。</p><p>想研究真實對戰，可在「賽事預測」新增／編輯隊伍與賽制，再手動輸入當場盤口、因子及有出處的分析筆記。輸入仍屬使用者資料，本站不會自動認證為官方資訊。</p></div><div class="source-list">${SOURCES.map((s,i)=>`<a class="source-row" href="${s.url}" target="_blank" rel="noopener noreferrer"><span class="source-number">0${i+1}</span><div><h3>${s.title}</h3><small>${s.publisher}</small><p>${s.detail}</p></div>${icon('external')}</a>`).join('')}</div><div class="panel method-card"><h2>模型能說什麼？</h2><p>五個相對評分（0–100；50 均衡）依分析流派加權得到 s，單局參數 p = 1 / (1 + exp(−(s−50)/24))，限制於 0.1–0.9。枚舉先取得多數勝局的終局比數，再加總對應玩法的機率。</p><p>模型假設每局獨立、單局實力固定；未針對 2026 賽事訓練，沒有校準或回測。總局數讓分僅支援左隊 −1.5／右隊 +1.5；大小支援 BO3 的 2.5 局及 BO5 的 3.5／4.5 局。這不是擊殺數大小或讓分。</p><p>盤口損益平衡機率 = 1 / 十進位賠率；去水機率 = 各選項隱含機率 / 總隱含機率。後者須輸入同一玩法的完整互斥選項。差值是模型假設與盤口的比較，不是獲利保證。</p><p>首殺／首龍／首塔／首巴龍僅提供方向紀錄，不以系列賽勝率代替事件數據。玄學與筆記不會改變專業模型。</p></div></section><aside><section class="panel method-card timeline"><span class="tiny-label">WORLDS 2026</span><h2>賽事時間軸</h2><p class="small muted">日期依美國賽場當地時間；<br>台灣時間另列，均為 UTC+8。</p>${[['01','入圍賽','10/15–10/18 · 洛杉磯','BO5 · 四隊雙敗淘汰','台灣首場：10/16 02:00'],['02','瑞士輪','10/23–10/31 · Allen','BO1／BO3 · 三勝晉級','台灣首日：10/24 01:00'],['03','淘汰賽','11/03–11/14 · Allen／紐約','BO5 · 八強至總決賽','台灣總決賽：11/15 03:00']].map(([n,t,d,f,z])=>`<div class="timeline-item"><span>${n}</span><div><h3>${t}</h3><p>${d}</p><small>${f}<br>${z}</small></div></div>`).join('')}</section><section class="panel method-card"><h3>本機，代表什麼？</h3><p>不需帳號、不需 API Key。網站載入後不會傳送筆記與觀察資料。它們保存在此網址的 localStorage，換瀏覽器／連接埠或清除資料後不會保留，請定期匯出。</p><p>本工具不隸屬 Riot Games、任何戰隊或台灣運彩。無實際購券、付款或過關送單功能。</p></section></aside></div>`;
}
function render() { $('#app').innerHTML=shell(); }
function refreshNumbers() {
  const model=analysis(),market=currentMarket(),odds=marketOdds();
  if($('#win-value')) {$('#win-value').textContent=pct(model.win);$('#lose-value').textContent=pct(1-model.win);$('#win-bar').style.width=`${model.win*100}%`;$('#map-value').textContent=pct(model.p);}
  document.querySelectorAll('.model-prob').forEach(e=>e.textContent=pct(market.options[Number(e.dataset.option)]?.p));
  const fair=implied(odds);
  document.querySelectorAll('.break-even').forEach(e=>e.textContent=pct(fair?.raw[Number(e.dataset.option)]));
  if($('#market-summary')) $('#market-summary').innerHTML=marketSummary(market,odds);
}
function openEditor(edit=false) {
  const m=edit?current():{a:'',b:'',bestOf:5,stage:'playin'};
  $('#editor').innerHTML=`<form id="match-form" class="form-stack"><div class="section-head"><div><span class="tiny-label lime">MATCH SETUP</span><h2 id="editor-title">${edit?'編輯':'新增'}情境對戰</h2></div><button type="button" class="icon-button" id="close-editor" aria-label="關閉">${icon('close')}</button></div><p class="small muted">輸入你要研究的隊伍，之後再調整評分與盤口。自訂資料仍標記為情境，不會自動變成官方賽程。</p><label>左方隊伍<input name="a" value="${esc(m.a)}" required maxlength="30" placeholder="例如 T1"></label><label>右方隊伍<input name="b" value="${esc(m.b)}" required maxlength="30" placeholder="例如 BLG"></label><div class="form-pair"><label>賽制<select name="bestOf">${[1,3,5].map(n=>`<option value="${n}" ${m.bestOf===n?'selected':''}>BO${n}</option>`).join('')}</select></label><label>階段<select name="stage">${Object.entries(STAGES).filter(([k])=>k!=='all').map(([k,v])=>`<option value="${k}" ${m.stage===k?'selected':''}>${v}</option>`).join('')}</select></label></div><input type="hidden" name="edit" value="${edit?'yes':'no'}"><button type="submit" class="button primary">${icon('check')}${edit?'套用變更':'建立對戰'}</button></form>`;
  if(edit && m.custom) $('#match-form').insertAdjacentHTML('beforeend',`<button type="button" class="text-button" id="remove-custom">${FIXTURES.some(x=>x.id===m.id)?'還原示範對戰':'移除此自訂對戰'}</button>`);
  $('#editor').showModal();
}
function savePick() {
  const m=current(),market=currentMarket(),odds=marketOdds();
  if(!implied(odds)) {toast('請先修正賠率，必須大於 1 且不超過 1000。');return;}
  const o=market.options[state.pick];
  const stories=[...document.querySelectorAll('[data-story]:checked')].map(e=>STORIES.find(s=>s.id===e.dataset.story)?.title).filter(Boolean);
  const n=state.notes[m.id],note=[stories.length?`玄學觀察：${stories.join('、')}`:'',n?.text?`${n.author||'個人筆記'}：${n.text}`:''].filter(Boolean).join('\n');
  const saved={id:m.id,matchLabel:`${m.a} vs ${m.b}`,marketLabel:market.label,label:o.label,odds:odds[state.pick],probability:o.p,created:new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'short'}).format(new Date()),note:note.slice(0,1000)};
  const exists=state.saved.some(s=>s.id===m.id); state.saved=[saved,...state.saved.filter(s=>s.id!==m.id)].slice(0,100);persist();render();toast(exists?'已更新這場的觀察方向（同場保留一筆）。':'已加入我的觀察，儲存在本機。');
}
function exportData() {
  const backup={version:1,custom:matches.filter(m=>m.custom),saved:state.saved,notes:state.notes};
  const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='nexus-worlds-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('備份已匯出。');
}
async function importData(file) {
  if(!file) return;
  if(file.size>500000) {toast('檔案過大，請選擇小於 500 KB 的 NEXUS 備份。');return;}
  try {
    const data=JSON.parse(await file.text());
    if(data.version!==1||!Array.isArray(data.saved)||data.saved.length>100||!Array.isArray(data.custom)||data.custom.length>30||!data.notes||typeof data.notes!=='object') throw Error();
    const custom=data.custom.map(validateMatch);if(custom.some(x=>!x)) throw Error();
    if(matches.filter(m=>m.custom).length+custom.length>30) {toast('合併後會超過 30 場自訂對戰；未匯入任何資料。');return;}
    const validSaved=data.saved.every(x=>x&&typeof x.id==='string'&&x.id.length<=100&&['label','matchLabel','marketLabel','created','note'].every(k=>typeof x[k]==='string'&&x[k].length<=1000)&&Number.isFinite(x.odds)&&x.odds>1&&x.odds<=1000&&(x.probability===null||(Number.isFinite(x.probability)&&x.probability>=0&&x.probability<=1)));
    if(!validSaved) throw Error();
    const newCount=data.saved.filter(x=>data.custom.some(m=>m.id===x.id)||!state.saved.some(s=>s.id===x.id)).length;
    if(state.saved.length+newCount>100) {toast('合併後會超過 100 筆觀察；未匯入任何資料。');return;}
    // Merge imports without replacing existing records. Remap custom IDs and their notes.
    const idMap=new Map();
    for(const m of custom) {const old=m.id;m.id=`custom-${crypto.randomUUID()}`;idMap.set(old,m.id);if(matches.filter(x=>x.custom).length<30)matches.push(m);}
    for(const row of data.saved) {const s={id:idMap.get(row.id)||row.id,label:row.label,matchLabel:row.matchLabel,marketLabel:row.marketLabel,created:row.created,note:row.note,odds:row.odds,probability:row.probability};if(!state.saved.some(x=>x.id===s.id)&&state.saved.length<100)state.saved.push(s);}
    for(const [old,n] of Object.entries(data.notes).slice(0,100)) {const id=idMap.get(old)||old;if(matches.some(m=>m.id===id)&&!state.notes[id]&&n&&typeof n==='object') state.notes[id]={author:String(n.author||'').slice(0,80),url:safeURL(n.url),text:String(n.text||'').slice(0,3000)};}
    persist();render();toast('已合併備份，既有觀察與筆記保留。');
  } catch {toast('備份格式不正確，未匯入資料。');}
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button,a[data-nav]');if(!b)return;
  if(b.dataset.nav) {e.preventDefault();route(b.dataset.nav);}
  else if(b.dataset.stage) {state.stage=b.dataset.stage;render();}
  else if(b.dataset.match) {route('matches',b.dataset.match);$('#analysis')?.scrollIntoView({behavior:'smooth',block:'start'});}
  else if(b.dataset.oddsMatch) {route('matches',b.dataset.oddsMatch);state.pick=Number(b.dataset.side);render();$('#analysis')?.scrollIntoView({behavior:'smooth'});}
  else if(b.dataset.preview) {state.tab=b.dataset.preview;render();}
  else if(b.dataset.focus) {state.tab=b.dataset.focus;route('matches');$('#analysis')?.scrollIntoView({behavior:'smooth'});}
  else if(b.dataset.tab) {state.tab=b.dataset.tab;render();$(`#tab-${state.tab}`)?.focus({preventScroll:true});}
  else if(b.dataset.pick!==undefined) {state.pick=Number(b.dataset.pick);const pos=window.scrollY;render();window.scrollTo(0,pos);}
  else if(b.id==='clear-filters') {state.stage='all';state.search='';render();}
  else if(b.id==='reset-scores') {delete state.scores[current().id];render();toast('已還原示範評分。');}
  else if(b.id==='new-match') openEditor();
  else if(b.id==='edit-match') openEditor(true);
  else if(b.id==='close-editor') $('#editor').close();
  else if(b.id==='remove-custom') {const m=current(),original=FIXTURES.find(x=>x.id===m.id);matches=original?matches.map(x=>x.id===m.id?{...original,scores:[...original.scores]}:x):matches.filter(x=>x.id!==m.id);if(!original){state.saved=state.saved.filter(x=>x.id!==m.id);delete state.notes[m.id];}delete state.scores[m.id];$('#editor').close();persist();route('matches',original?.id||matches[0].id);toast(original?'已還原示範對戰。':'已移除自訂對戰與相關觀察／筆記。');}
  else if(b.id==='save-pick') savePick();
  else if(b.id==='export') exportData();
  else if(b.dataset.remove) {state.saved=state.saved.filter(x=>x.id!==b.dataset.remove);persist();render();toast('已移除觀察。');}
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.factor!==undefined) {const i=Number(t.dataset.factor),m=current();state.scores[m.id]||=[...m.scores];state.scores[m.id][i]=Number(t.value);$(`#factor-value-${i}`).textContent=t.value;t.setAttribute('aria-valuetext',`${m.a} 相對評分 ${t.value}，50 為均衡`);refreshNumbers();}
  if(t.dataset.odd!==undefined) {const odds=[...marketOdds()];odds[Number(t.dataset.odd)]=t.value===''?NaN:Number(t.value);state.odds[oddsKey()]=odds;t.setAttribute('aria-invalid',String(!Number.isFinite(odds[Number(t.dataset.odd)])||odds[Number(t.dataset.odd)]<=1||odds[Number(t.dataset.odd)]>1000));refreshNumbers();}
  if(t.id==='search') {const start=t.selectionStart;state.search=t.value;render();$('#search').focus();$('#search').setSelectionRange(start,start);}
});
document.addEventListener('change',e=>{
  if(e.target.id==='preset'){state.preset=e.target.value;refreshNumbers();}
  if(e.target.id==='market'){state.market=e.target.value;state.pick=0;render();}
  if(e.target.id==='total-line'){state.total=Number(e.target.value);state.pick=0;render();}
  if(e.target.id==='import') importData(e.target.files[0]);
});
document.addEventListener('keydown',e=>{
  const tab=e.target.closest('[role="tab"][data-tab]');
  if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const keys=['pro','mystic','notes'],i=keys.indexOf(state.tab);
  state.tab=e.key==='Home'?keys[0]:e.key==='End'?keys[2]:keys[(i+(e.key==='ArrowRight'?1:2))%3];
  render();$(`#tab-${state.tab}`).focus({preventScroll:true});
});
document.addEventListener('submit',e=>{
  if(e.target.id==='note-form'){e.preventDefault();const f=new FormData(e.target),url=String(f.get('url')||'');if(url&&!safeURL(url)){toast('來源連結僅接受 http 或 https。');return;}state.notes[current().id]={author:String(f.get('author')||'').slice(0,80),url:safeURL(url),text:String(f.get('text')||'').slice(0,3000)};persist();render();toast('分析筆記已儲存。');}
  if(e.target.id==='match-form'){e.preventDefault();const f=new FormData(e.target),editing=f.get('edit')==='yes',old=current();if(!editing&&matches.filter(m=>m.custom).length>=30){toast('最多保存 30 場自訂對戰。');return;}const m=validateMatch({id:editing?old.id:`custom-${crypto.randomUUID()}`,a:f.get('a'),b:f.get('b'),stage:f.get('stage'),bestOf:Number(f.get('bestOf')),scores:editing?old.scores:[50,50,50,50,50],odds:editing?old.odds:[1.9,1.9]});if(!m){toast('請輸入兩個不同隊名與有效賽制。');return;}if(editing){matches=matches.map(x=>x.id===old.id?m:x);delete state.scores[m.id];for(const key of Object.keys(state.odds))if(key.startsWith(m.id+'-'))delete state.odds[key];}else matches.push(m);$('#editor').close();persist();state.stage='all';state.search='';route('matches',m.id);toast('情境對戰已儲存。');}
});
const hash=location.hash;
if(hash.startsWith('#match=')){let id='';try{id=decodeURIComponent(hash.slice(7));}catch{}if(matches.some(m=>m.id===id)){state.selected=id;state.view='matches';state.total=current().bestOf===5?3.5:2.5;}}
else if(['#watchlist','#methods'].includes(hash))state.view=hash.slice(1);
render();
