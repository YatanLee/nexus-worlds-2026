export const SOURCES=[
 {title:'Riot 官方 Worlds 賽程與 GPR',url:'https://lolesports.com/en-US/leagues/worlds',detail:'每日爬取公開頁面的結構資料。對戰、時間、BO 與隊伍 Elo 皆保留來源；分頁未載入的場次不自行補齊。'},
 {title:'2026 世界賽官方指南',url:'https://lolesports.com/en-GB/news/worlds-2026-primer',detail:'賽事階段與背景。對戰時間以每日同步的官方賽程資料為準。'},
 {title:'DRX 2022 世界賽幕後紀錄',url:'https://lolesports.com/en-US/lolesports/news/making-of-a-god-behind-the-scenes-of-deft-s-worlds-2022',detail:'Riot 對 2022 DRX 世界賽歷程的回顧；單一傳奇案例不能推論本屆冷門機率。'},
 {title:'2023 世界冠軍 T1',url:'https://www.leagueoflegends.com/ko-kr/news/announcements/2023-worlds-champion-t1/',detail:'隊史與世界賽記憶的案例；不同年份的選手與版本不能直接類比。'}
];
export const PLAYERS={
 C9:{name:'Blaber',role:'Jungle',confidence:'官方名單 · 先發待確認',roster:'Thanatos / Blaber / Loki、APA / Tactical、Zven / Vulcan',source:'https://cloud9.gg/teams/league-of-legends/',checkedAt:'2026-10-15',focus:'觀察打野的前兩輪路線，能否把河道視野轉成首條物件與安全回城。',swing:'若前期節奏受壓，邊線支援與物件交換會成為系列賽的轉折。',caution:'官方頁列有 7 位選手；本站不把名單視為本場確定先發，也未取得本屆個人數據。',mystic:'隊史、賽區與世界賽敘事請到玄學評估分頁查看來源與適用範圍；不把它套用成此選手的能力評分。'},
 KC:{name:'Caliste',role:'Bot',confidence:'官方隊伍名單 · 本場先發待確認',roster:'Canna / Yike / kyeahoo / Caliste / Busio',source:'https://www.karminecorp.fr/en/pages/nos-joueurs-league-of-legends',checkedAt:'2026-10-15',focus:'觀察下路資源分配、第一件裝備的時間點，以及團戰輸出位置。',swing:'若對手把壓力集中下路，輔野支援與中期轉線能否保住輸出空間值得追蹤。',caution:'觀察焦點依角色提出，不代表已驗證的選手優劣，也不宣稱有本屆 KDA 或傷害數據。',mystic:'隊史、賽區與世界賽敘事請到玄學評估分頁查看來源與適用範圍；不把它套用成此選手的能力評分。'},
 FUR:{name:'Tutsz',role:'Mid · 位置依次級名單',confidence:'官方隊伍成員 · 位置待官方核對',roster:'Ayu / Guigo / JoJo / Tatu / Tutsz',source:'https://us.furia.gg/teams/lol',secondary:'https://lol.fandom.com/wiki/FURIA',checkedAt:'2026-10-15',focus:'觀察中路能否取得移動時間，讓打野進河道與邊線支援更安全。',swing:'中路若被限制在線上，邊線壓力與中立物件的選擇會更依賴團隊交換。',caution:'官方頁可確認成員，未列位置；Mid 角色來自次級名單，並非已確認的本場出賽資訊。',mystic:'隊史、賽區與世界賽敘事請到玄學評估分頁查看來源與適用範圍；不把賽區故事或觀眾印象當成隊伍勝率。'},
 MVK:{name:'Gury',role:'Jungle · 待官方核對',confidence:'次級賽事名單 · 先發未確認',roster:'Kratos / Gury / Chika / Harky / SiuLoong（次級名單）',source:'https://mid.gg/esports/teams/mvk-esports',checkedAt:'2026-10-15',focus:'若 Gury 確認出賽，觀察野區資訊交換與第一次跨線支援，能否帶動團隊節奏。',swing:'缺乏可靠的本屆選手樣本；先確認先發，再評估角色對位與臨場選擇。',caution:'尚未找到可核實的官方完整先發名單。此處為條件式觀察，不拿未知資料打分。',mystic:'隊史、賽區與世界賽敘事請到玄學評估分頁查看來源與適用範圍；資訊較少不等於存在隱藏優勢。'}
};
export const THEMES={
 underdog:{label:'黑馬劇本',title:'傳奇逆襲，能否只當成一條觀賽線索？',text:'從有來源的世界賽逆轉故事找可比較之處，先寫明隊伍、陣容與年份的差異，再替賽前對局保留一個主觀比分劇本。',limit:'單一成功案例有倖存者偏差。沒有玄學命中率；此比分是主觀劇本。',source:2},
 legacy:{label:'大賽記憶',title:'隊史記憶，哪些能套用到今天？',text:'只把同一組織的舊陣容、賽區類比與世界賽共通故事分開呈現；每條敘事都附來源、適用範圍與反例。',limit:'隊史不能繼承成現在的勝率；版本、陣容與教練都會改變。',source:3},
 momentum:{label:'氣勢延續',title:'近期賽果，是延續還是復仇的起點？',text:'只列開賽前已確認的本屆官方賽果，讓連勝、失利與再戰成為並列觀賽劇本，而非對未來的保證。',limit:'本站沒有即時士氣或更衣室資訊；這是敘事選擇，沒有統計加權。',source:null}
};
