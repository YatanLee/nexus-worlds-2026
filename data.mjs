export const SOURCES = [
  { title:'2026 世界賽官方指南', publisher:'Riot Games · 2026/10/05', url:'https://lolesports.com/en-GB/news/worlds-2026-primer', detail:'賽制、參賽隊伍、階段日期與官方時區。本站對戰卡均為情境，未接入官方抽籤／賽程。' },
  { title:'英雄聯盟可投注玩法', publisher:'台灣運彩 · 查閱 2026/10/15', url:'https://article.sportslottery.com.tw/zh-tw/innovation/1', detail:'玩法分類依官方英雄聯盟項目整理。官方支援某玩法，不代表每場都會開賣。' },
  { title:'運動彩券投注規範', publisher:'台灣運彩 · 查閱 2026/10/15', url:'https://article.sportslottery.com.tw/zh-tw/about-us/135', detail:'實際投注選項、讓分／大小標的、取消與派彩，均以官方當場公告為準。' },
  { title:'DRX: The Rise', publisher:'LoL Esports · 2023/07/05', url:'https://lolesports.com/en-US/news/drx-the-rise', detail:'DRX 於 2022 年從入圍賽出發奪冠，是黑馬敘事的歷史案例。' },
  { title:'2023 世界冠軍 T1', publisher:'Riot Games · 2023/11/19', url:'https://www.leagueoflegends.com/ko-kr/news/announcements/2023-worlds-champion-t1/', detail:'T1 在 2023 年拿下第四座世界冠軍，距上次奪冠相隔七年。' }
];

export const FACTORS = [
  ['form','近期狀態','近 10 局、對手強度與陣容完整度'],
  ['lane','對線優勢','前 15 分鐘節奏與對位壓力'],
  ['objective','物件控制','小龍、巴龍與視野轉化能力'],
  ['meta','版本適應','英雄池與 Fearless BP 的調整'],
  ['experience','系列賽經驗','長系列的調整與逆風處理']
];
export const PRESETS = {
  balanced: { label:'綜合分析', weights:[.25,.2,.25,.2,.1] },
  tempo: { label:'前期節奏派', weights:[.2,.4,.2,.15,.05] },
  macro: { label:'營運／BP 派', weights:[.15,.1,.35,.3,.1] }
};
export const FIXTURES = [
  { id:'c9-kc', a:'C9', b:'KC', nameA:'Cloud9', nameB:'Karmine Corp', regionA:'LCS', regionB:'LEC', stage:'playin', bestOf:5, scores:[62,55,64,57,51], odds:[1.72,2.08], colorA:'#54bcef', colorB:'#aabafa' },
  { id:'fur-mvk', a:'FUR', b:'MVK', nameA:'FURIA', nameB:'MVK Esports', regionA:'CBLOL', regionB:'LCP', stage:'playin', bestOf:5, scores:[56,48,59,52,57], odds:[1.65,2.2], colorA:'#e2e6ec', colorB:'#65d6cf' },
  { id:'gen-blg', a:'GEN', b:'BLG', nameA:'Gen.G', nameB:'Bilibili Gaming', regionA:'LCK', regionB:'LPL', stage:'swiss', bestOf:3, scores:[58,52,61,48,63], odds:[1.83,1.95], colorA:'#d6b765', colorB:'#e5a5d4' },
  { id:'t1-al', a:'T1', b:'AL', nameA:'T1', nameB:"Anyone’s Legend", regionA:'LCK', regionB:'LPL', stage:'knockout', bestOf:5, scores:[54,46,55,52,71], odds:[1.9,1.8], colorA:'#fa7c8c', colorB:'#e7a76e' }
];
export const STAGES = { all:'全部', playin:'入圍賽', swiss:'瑞士輪', knockout:'淘汰賽' };
export const MARKET_LABELS = { winner:'不讓分', map:'單局不讓分（第 1 局）', handicap:'[總局數] 讓分', total:'[總局數] 大小', score:'正確比數', kill:'[單局] 第 1 個擊殺', dragon:'[單局] 第 1 隻小龍', tower:'[單局] 第 1 座防禦塔', baron:'[單局] 第 1 隻巴龍' };
export const STORIES = [
  { id:'underdog', icon:'spark', title:'黑馬劇本，從來沒寫完', tag:'2022 · DRX', text:'從入圍賽走到冠軍，DRX 提醒我們：種子序與名氣並非結局。直覺派會把目光留給被低估的一方。', limitation:'這是單一奪冠故事；大量未奪冠黑馬未被計入，有倖存者偏差。不能推出冷門勝率。', target:'觀察方向：弱勢方不讓分／總局數受讓', source:3 },
  { id:'legacy', icon:'crown', title:'大賽的記憶，會醒過來嗎？', tag:'2023 · T1', text:'T1 在相隔七年後重新奪冠。熟悉舞台的隊名，總讓觀眾想起「世界賽會變身」的老梗。', limitation:'不同年份的選手、版本與對手不同。隊史光環不能代替當前陣容分析。', target:'觀察方向：不讓分／正確比數', source:4 },
  { id:'reverse', icon:'moon', title:'「大家都看好」的反向直覺', tag:'社群敘事 · 無統計證據', text:'熱門翻車特別容易被記住。玄學派會先問：我是在看比賽，還是在跟著人氣走？', limitation:'未蒐集完整人氣與結果樣本，不能聲稱反買有效，更沒有可用命中率。', target:'觀察方向：先比對賠率，再檢查自己的偏見', source:null }
];
