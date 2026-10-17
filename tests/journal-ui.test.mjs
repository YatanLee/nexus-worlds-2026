import test from 'node:test';
import assert from 'node:assert/strict';
import {journalBackupTools,journalPanel} from '../journal-ui.mjs';

const match={id:'10000000001',startTime:'2026-10-20T12:00:00Z',bestOf:3,state:'scheduled',teams:[{id:'20000000001',code:'AAA',wins:0},{id:'0',code:'TBD',wins:0}]};

test('TBD journal explains that the available freeform notes are the place for observations',()=>{
 const view=journalPanel({match,status:'waiting'});
 assert.match(view,/自由筆記/);
 assert.match(view,/journal-reason"[^>]*disabled/);
});

test('corrupt private storage is visibly recoverable and never presents writable inputs',()=>{
 const panel=journalPanel({match,status:'waiting',storageBlocked:true});
 const backup=journalBackupTools({storageBlocked:true,statusMessage:'recover first'});
 assert.match(panel,/原始資料/);
 assert.match(panel,/journal-score" disabled/);
 assert.match(backup,/journal-export-raw/);
 assert.match(backup,/journal-import"[^>]*disabled/);
 assert.match(backup,/recover first/);
});

test('open private form shows unsaved fields by team ID, while locked form shows only committed prediction',()=>{
 const known={...match,teams:[{id:'20000000001',code:'AAA',wins:0},{id:'20000000002',code:'BBB',wins:0}]};
 const entry={reason:'saved reason',keyPlayerObservation:'saved player',mysticChoice:'legacy',predictedScore:[{id:'20000000001',wins:2},{id:'20000000002',wins:0}],reflection:''};
 const draft={reason:'unsaved <script>text</script>',keyPlayerObservation:'draft player',mysticChoice:'momentum',predictedScore:[{id:'20000000002',wins:2},{id:'20000000001',wins:1}]};
 const open=journalPanel({match:known,entry,status:'open',draft,hasDraft:true});
 assert.ok(open.includes('value="1-2" selected'));assert.ok(open.includes('unsaved &lt;script&gt;text&lt;/script&gt;'));assert.ok(open.includes('draft player'));assert.ok(open.includes('value="momentum" selected'));assert.ok(open.includes('尚未儲存'));
 const locked=journalPanel({match:known,entry,status:'locked',draft,hasDraft:true});
 assert.ok(locked.includes('saved reason'));assert.ok(!locked.includes('unsaved &lt;script&gt;'));assert.ok(!locked.includes('draft player'));assert.ok(locked.includes('不會套用'));
 const swapped=journalPanel({match:{...known,teams:[...known.teams].reverse()},entry,status:'open',draft,hasDraft:true});assert.ok(swapped.includes('value="2-1" selected'));
});
