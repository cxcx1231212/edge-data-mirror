import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewRows,chronologicalRows,nextDrawPeriod} from '../public/assets/triples-review.js';
const draw=(period,numbers=[1,2,3,4,5,6,7])=>({period,numberList:numbers.map(number=>({number}))});
test('two latest periods display oldest first, including year rollover',()=>{
  assert.deepEqual(chronologicalRows(reviewRows([draw(257),draw(259),draw(258)],2026)).map(r=>r.period),['258','259']);
  assert.deepEqual(chronologicalRows([{year:2026,period:'1'},{year:2025,period:'365'}]).map(r=>r.period),['365','1']);
});
test('pending period comes from the upstream schedule, never an invented increment',()=>{
  assert.equal(nextDrawPeriod({code:10000,data:{nextLotteryNumber:'260'}}),'260');
  assert.equal(nextDrawPeriod({code:10000,data:{nextIntLotteryNumber:1}}),'1');
  for(const data of [{},{nextLotteryNumber:'bad'},{nextLotteryNumber:0},{period:259}])assert.equal(nextDrawPeriod({code:10000,data}),null);
  assert.equal(nextDrawPeriod({code:500,data:{nextLotteryNumber:260}}),null);
});
test('historical examples are stable, unique and contain only that draw regular numbers',()=>{
  const input=[draw(257),draw(259),draw(258)];
  const rows=reviewRows(input,2026);assert.deepEqual(rows.map(r=>r.period),['259','258']);
  assert.deepEqual(rows,reviewRows(input,2026));
  for(const row of rows){assert.equal(row.groups.length,6);assert.equal(new Set(row.groups.map(g=>g.join(','))).size,6);for(const group of row.groups){assert.equal(new Set(group).size,3);assert.ok(group.every(n=>row.regular.includes(n)));assert.ok(!group.includes(row.special));}}
});
test('incomplete, invalid and duplicate draws are not shown',()=>{
  const rows=reviewRows([draw(10,[1,2,3]),draw(11,[1,2,3,4,5,6,6]),draw(12,[1,2,3,4,5,6,50]),draw('bad'),draw(9),draw(9)],2026);
  assert.equal(rows.length,1);assert.equal(rows[0].period,'9');assert.deepEqual(reviewRows([],2026),[]);
});
