import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAYER_REVIEW_MS,SOURCE_MAX_AGE_MS,playerReview,ratingResultLag,recentOfficialResults,sourceFreshness} from '../freshness.mjs';

const now=Date.parse('2026-10-17T12:00:00Z');
test('source freshness preserves unknown and has strict 26-hour boundary',()=>{
  assert.equal(sourceFreshness(null,now).state,'unknown');
  assert.equal(sourceFreshness('2026-10-16T10:00:00Z',now).state,'fresh');
  assert.equal(sourceFreshness('2026-10-16T09:59:59Z',now).state,'stale');
  assert.equal(sourceFreshness('2026-10-17T12:01:00Z',now).state,'future');
  assert.equal(SOURCE_MAX_AGE_MS,26*60*60*1000);
});
test('manual player review starts after seven complete days',()=>{
  assert.equal(playerReview('2026-10-10',Date.parse('2026-10-16T16:00:00Z')).state,'current');
  assert.equal(playerReview('2026-10-10',Date.parse('2026-10-16T16:00:01Z')).state,'review');
  assert.equal(playerReview(null,now).state,'unknown');
  assert.equal(playerReview('2026-02-30',now).state,'unknown');
  assert.equal(playerReview('2026-10-18',now).state,'future');
  assert.equal(PLAYER_REVIEW_MS,7*24*60*60*1000);
});
test('recent official results use team IDs and ratings flag only later completed results',()=>{
  const matches=[
    {id:'old',state:'completed',startTime:'2026-10-15T12:00:00Z',teams:[{id:'A',wins:3},{id:'B',wins:0}]},
    {id:'new',state:'completed',startTime:'2026-10-17T10:00:00Z',teams:[{id:'B',wins:1},{id:'A',wins:3}]},
    {id:'future',state:'completed',startTime:'2026-10-17T13:00:00Z',teams:[{id:'A',wins:3},{id:'C',wins:1}]},
    {id:'other',state:'completed',startTime:'2026-10-17T11:00:00Z',teams:[{id:'X',wins:3},{id:'Y',wins:1}]}
  ];
  assert.deepEqual(recentOfficialResults(matches,'A',now).map(match=>match.id),['new','old']);
  assert.equal(ratingResultLag({calculatedAt:'2026-10-17T09:00:00Z'},'A',matches,now).latest.id,'new');
  assert.equal(ratingResultLag({calculatedAt:'2026-10-17T10:00:00Z'},'A',matches,now).lagged,false);
  assert.equal(ratingResultLag({},'A',matches,now).lagged,false);
});
