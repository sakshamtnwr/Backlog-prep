import assert from 'node:assert/strict';
import {
  calculateBacklog,
  getBacklogRecoveryCutoff,
} from './dist/backlogEngine.js';

const task = (id, title, durationMinutes, completed = false, subject = 'Networking') => ({
  id, title, subject, durationMinutes, completed,
});
const plan = (date, tasks = [], fixedCommitmentMinutes = 0) => ({
  date, tasks, fixedCommitmentMinutes,
});
const freePlan = (date, tasks = [], freeMinutes = 600) => {
  // Used minutes = 24h - 7h sleep - freeMinutes.
  // Fixed commitments absorb the remaining non-study/non-sleep time.
  const planned = tasks.reduce((sum, item) => sum + item.durationMinutes, 0);
  return plan(date, tasks, 1440 - 420 - freeMinutes - planned);
};

// Cutoff is five calendar days before the target and is inclusive.
assert.equal(getBacklogRecoveryCutoff('2026-11-30'), '2026-11-25');

// 6h missed on Day 1 -> evenly spread over Days 2, 3, 4.
{
  const result = calculateBacklog({
    startDate: '2026-11-01', targetDate: '2026-11-30', today: '2026-11-02',
    plans: [
      freePlan('2026-11-01', [task('net-1', 'OSI model', 360)], 600),
      freePlan('2026-11-02', [], 600),
      freePlan('2026-11-03', [], 600),
      freePlan('2026-11-04', [], 600),
    ],
    backlogSessions: [],
  });
  const rows = result.allocations.filter((x) => x.batchId === '2026-11-01::net-1');
  assert.deepEqual(rows.map((x) => x.minutes), [120, 120, 120]);
}

// Day 2 has only 1h free -> 1h, then 2.5h + 2.5h on the remaining days.
{
  const result = calculateBacklog({
    startDate: '2026-11-01', targetDate: '2026-11-30', today: '2026-11-02',
    plans: [
      freePlan('2026-11-01', [task('net-1', 'OSI model', 360)], 600),
      freePlan('2026-11-02', [], 60),
      freePlan('2026-11-03', [], 600),
      freePlan('2026-11-04', [], 600),
    ],
    backlogSessions: [],
  });
  const rows = result.allocations.filter((x) => x.batchId === '2026-11-01::net-1');
  assert.deepEqual(rows.map((x) => x.minutes), [60, 150, 150]);
}

// Missed Day 2 recovery is redistributed over Days 3 and 4; it is not discarded early.
{
  const batchId = '2026-11-01::net-1';
  const result = calculateBacklog({
    startDate: '2026-11-01', targetDate: '2026-11-30', today: '2026-11-03',
    plans: [
      freePlan('2026-11-01', [task('net-1', 'OSI model', 360)], 600),
      freePlan('2026-11-02', [task('cpp-1', 'Pointers', 120, false, 'C++')], 600),
      freePlan('2026-11-03', [], 600),
      freePlan('2026-11-04', [], 600),
      freePlan('2026-11-05', [], 600),
    ],
    backlogSessions: [],
  });
  const oldRows = result.allocations.filter((x) => x.batchId === batchId);
  assert.deepEqual(oldRows.map((x) => x.date), ['2026-11-03', '2026-11-04']);
  assert.deepEqual(oldRows.map((x) => x.minutes), [180, 180]);
  const newerRows = result.allocations.filter((x) => x.batchId === '2026-11-02::cpp-1');
  assert.ok(newerRows.every((x) => x.date >= '2026-11-03' && x.date <= '2026-11-05'));
}

// Oldest batch gets first claim on shared capacity.
{
  const result = calculateBacklog({
    startDate: '2026-11-01', targetDate: '2026-11-30', today: '2026-11-03',
    plans: [
      freePlan('2026-11-01', [task('a', 'Old topic', 180)], 600),
      freePlan('2026-11-02', [task('b', 'New topic', 180)], 600),
      freePlan('2026-11-03', [], 120),
      freePlan('2026-11-04', [], 120),
      freePlan('2026-11-05', [], 120),
    ],
    backlogSessions: [],
  });
  const oldOnDay3 = result.allocations.find((x) => x.batchId === '2026-11-01::a' && x.date === '2026-11-03');
  const newOnDay3 = result.allocations.find((x) => x.batchId === '2026-11-02::b' && x.date === '2026-11-03');
  assert.ok(oldOnDay3);
  assert.ok(oldOnDay3.minutes > (newOnDay3?.minutes ?? 0));
  assert.equal(newOnDay3?.minutes, 30);
}

// Completed recovery block counts its saved minutes, not actual study time or another task.
{
  const batchId = '2026-11-01::net-1';
  const result = calculateBacklog({
    startDate: '2026-11-01', targetDate: '2026-11-30', today: '2026-11-03',
    plans: [
      freePlan('2026-11-01', [task('net-1', 'OSI model', 360)], 600),
      freePlan('2026-11-02', [], 600),
      freePlan('2026-11-03', [], 600),
      freePlan('2026-11-04', [], 600),
    ],
    backlogSessions: [{ batchId, date: '2026-11-02', allocatedMinutes: 120, completed: true }],
  });
  const batch = result.batches.find((x) => x.id === batchId);
  assert.equal(batch.recoveredMinutes, 120);
  assert.equal(batch.pendingMinutes, 240);
}

// After expiry, unfinished minutes become permanently discarded.
{
  const result = calculateBacklog({
    startDate: '2026-11-01', targetDate: '2026-11-30', today: '2026-11-05',
    plans: [
      freePlan('2026-11-01', [task('net-1', 'OSI model', 360)], 600),
      freePlan('2026-11-02', [], 600),
      freePlan('2026-11-03', [], 600),
      freePlan('2026-11-04', [], 600),
      freePlan('2026-11-05', [], 600),
    ],
    backlogSessions: [{ batchId: '2026-11-01::net-1', date: '2026-11-02', allocatedMinutes: 120, completed: true }],
  });
  const batch = result.batches.find((x) => x.id === '2026-11-01::net-1');
  assert.equal(batch.recoveredMinutes, 120);
  assert.equal(batch.discardedMinutes, 240);
  assert.equal(batch.status, 'expired');
}

// Work missed on the cutoff date cannot recover after the cutoff.
{
  const result = calculateBacklog({
    startDate: '2026-11-25', targetDate: '2026-11-30', today: '2026-11-26',
    plans: [freePlan('2026-11-25', [task('late', 'Late topic', 90)], 600)],
    backlogSessions: [],
  });
  const batch = result.batches.find((x) => x.id === '2026-11-25::late');
  assert.equal(batch.discardedMinutes, 90);
  assert.equal(batch.status, 'expired');
}


// Capacity shortage is shown as projected discard while the window is open;
// it becomes permanent discard only after the last recovery day closes.
{
  const input = {
    startDate: '2026-11-01', targetDate: '2026-11-30', today: '2026-11-02',
    plans: [
      freePlan('2026-11-01', [task('no-room', 'No room topic', 360)], 600),
      freePlan('2026-11-02', [], 0),
      freePlan('2026-11-03', [], 0),
      freePlan('2026-11-04', [], 0),
    ],
    backlogSessions: [],
  };
  const openWindow = calculateBacklog(input);
  assert.equal(openWindow.totals.projectedDiscardMinutes, 360);
  assert.equal(openWindow.totals.discardedMinutes, 0);

  const afterExpiry = calculateBacklog({ ...input, today: '2026-11-05' });
  assert.equal(afterExpiry.totals.projectedDiscardMinutes, 0);
  assert.equal(afterExpiry.totals.discardedMinutes, 360);
}

// The cutoff date itself remains a valid recovery date.
{
  const result = calculateBacklog({
    startDate: '2026-11-22', targetDate: '2026-11-30', today: '2026-11-25',
    plans: [
      freePlan('2026-11-22', [task('last-window', 'Last-window topic', 90)], 600),
      freePlan('2026-11-25', [], 120),
    ],
    backlogSessions: [],
  });
  const batch = result.batches.find((x) => x.id === '2026-11-22::last-window');
  assert.equal(batch.expiryDate, '2026-11-25');
  assert.equal(result.allocations.find((x) => x.batchId === batch.id)?.minutes, 90);
}

console.log('All backlog-engine tests passed.');
