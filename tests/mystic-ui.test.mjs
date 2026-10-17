import test from 'node:test';
import assert from 'node:assert/strict';
import {mysticView} from '../mystic-ui.mjs';
import {mysticAssessment} from '../mystic.mjs';
import {THEMES} from '../data.mjs';
const match={id:'115660588583171798',state:'scheduled',bestOf:5,startTime:'2026-10-17T18:00:00Z',observedAt:'2026-10-17T01:00:00Z',teams:[{id:'107251245690956393',code:'MVK',region:'PAC'},{id:'100205576309502431',code:'FUR',region:'BR'}]};
const icon=()=>'';
const render=assessment=>mysticView({assessment,match,theme:{id:'underdog',...THEMES.underdog},themes:THEMES,icon});

test('evidence UI distinguishes facts, applicability, counterexamples and missing direct history',()=>{
 const html=render(mysticAssessment(match,[],{win:.535},'underdog',Date.parse('2026-10-17T10:00:00Z')));
 for(const text of ['隊伍經歷','賽區記憶','世界賽特殊劇本','本屆賽果脈絡','已知事實','這場怎麼看','適用範圍與反例','查核','次級媒體','PAC','TPA','MVK、FUR'])assert.ok(html.includes(text),text);
 assert.ok(html.includes('aria-pressed="true"'));assert.ok(html.includes('rel="noopener noreferrer"'));
 const completed=render(mysticAssessment({...match,state:'completed'},[],{win:.535},'underdog',Date.parse('2026-10-18T10:00:00Z')));
 assert.ok(completed.includes('不生成新的賽前劇本'));assert.ok(!completed.includes('玄學比分劇本 ·'));
});

test('untrusted fields remain text and unsafe source URLs never become active links',()=>{
 const card={id:'unsafe',year:2022,title:'<img src=x onerror=alert(1)>',fact:'<script>bad()</script>',interpretation:'<svg onload=bad()>',scopeLabel:'<b>bad</b>',applies:'" onclick="bad()',limitation:'<iframe src=bad>',source:{title:'<img>',publisher:'<svg>',checkedAt:'<script>',type:'<iframe>'}};
 const credentials=new URL('https://lolesports.com/');credentials.username='synthetic-user';credentials.password='synthetic-password';
 for(const url of ['javascript:alert(1)','https://lolesports.com.evil.example/',credentials.href,'https://lolesports.com:444/','http://lolesports.com/','https://unreviewed.example/']){
  const html=render({team:[{...card,source:{...card.source,url}}],pregame:false});
  assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script'));assert.ok(!html.includes('<iframe'));
  assert.ok(!html.includes('href='),url);
 }
});

test('quote controls explicitly target a current evidence identity and show unavailable context',()=>{
 const assessment=mysticAssessment(match,[],null,'underdog',Date.parse('2026-10-17T10:00:00Z'));
 const view=quoteStatus=>mysticView({assessment,match,theme:{id:'underdog',...THEMES.underdog},themes:THEMES,icon,quoteStatus});
 const enabled=view({enabled:true});
 assert.ok(enabled.includes('data-evidence-lane="region" data-evidence-id="kabum-2014"'));
 assert.ok(enabled.includes('data-quote-stance="support"'));assert.ok(enabled.includes('data-quote-stance="counter"'));assert.ok(enabled.includes('尚未儲存'));
 const disabled=view({enabled:false,reason:'此場已鎖定 <test>'});assert.ok(disabled.includes('此場已鎖定 &lt;test&gt;'));assert.ok(/data-quote-stance="support"[^>]*disabled/.test(disabled));
});
