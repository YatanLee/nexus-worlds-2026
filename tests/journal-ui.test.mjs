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
