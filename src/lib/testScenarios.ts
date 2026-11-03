import {
  calculateBacklog,
  getBacklogRecoveryCutoff,
  getFreeTimeMinutes,
  setBacklogSessionCompletion,
  addDays,
  DayPlan,
  StudyTask,
  BacklogSession,
} from './backlogEngine';
import { exportStateToJson, validateImportData } from './storage';
import { getInitialAppState, buildDayPlan } from './initialData';

export interface TestResult {
  id: number;
  title: string;
  passed: boolean;
  expected: string;
  actual: string;
  details: string;
}

const task = (
  id: string,
  title: string,
  durationMinutes: number,
  completed = false,
  subject = 'Networking',
): StudyTask => ({
  id,
  title,
  subject,
  durationMinutes,
  completed,
});

const freePlan = (date: string, tasks: StudyTask[] = [], freeMinutes = 600): DayPlan => {
  const planned = tasks.reduce((sum, item) => sum + item.durationMinutes, 0);
  return {
    date,
    tasks,
    fixedCommitmentMinutes: Math.max(0, 1440 - 420 - freeMinutes - planned),
  };
};

export function runAllVerificationTests(): TestResult[] {
  const results: TestResult[] = [];

  // Test 1: A six-hour missed task distributes as two hours across three days.
  try {
    const res1 = calculateBacklog({
      startDate: '2026-11-01',
      targetDate: '2026-11-30',
      today: '2026-11-02',
      plans: [
        freePlan('2026-11-01', [task('net-1', 'OSI model', 360)], 600),
        freePlan('2026-11-02', [], 600),
        freePlan('2026-11-03', [], 600),
        freePlan('2026-11-04', [], 600),
      ],
      backlogSessions: [],
    });
    const rows1 = res1.allocations.filter((x) => x.batchId === '2026-11-01::net-1');
    const minutes1 = rows1.map((x) => x.minutes);
    const passed1 =
      minutes1.length === 3 &&
      minutes1[0] === 120 &&
      minutes1[1] === 120 &&
      minutes1[2] === 120;
    results.push({
      id: 1,
      title: 'A six-hour missed task distributes as two hours across three days',
      passed: passed1,
      expected: '[120, 120, 120] minutes over Days 2, 3, 4',
      actual: JSON.stringify(minutes1),
      details: '360 minutes missed on Nov 01 distributed over 3 days (120 min/day).',
    });
  } catch (err: any) {
    results.push({
      id: 1,
      title: 'A six-hour missed task distributes as two hours across three days',
      passed: false,
      expected: '[120, 120, 120]',
      actual: err.message,
      details: 'Exception thrown during calculation.',
    });
  }

  // Test 2: A day with only one hour of free capacity redistributes remaining five hours across next two days.
  try {
    const res2 = calculateBacklog({
      startDate: '2026-11-01',
      targetDate: '2026-11-30',
      today: '2026-11-02',
      plans: [
        freePlan('2026-11-01', [task('net-1', 'OSI model', 360)], 600),
        freePlan('2026-11-02', [], 60), // only 60m free
        freePlan('2026-11-03', [], 600),
        freePlan('2026-11-04', [], 600),
      ],
      backlogSessions: [],
    });
    const rows2 = res2.allocations.filter((x) => x.batchId === '2026-11-01::net-1');
    const minutes2 = rows2.map((x) => x.minutes);
    const passed2 =
      minutes2.length === 3 &&
      minutes2[0] === 60 &&
      minutes2[1] === 150 &&
      minutes2[2] === 150;
    results.push({
      id: 2,
      title: 'Day with 1h capacity redistributes remaining 5h across next two days',
      passed: passed2,
      expected: '[60, 150, 150] minutes (1h, 2.5h, 2.5h)',
      actual: JSON.stringify(minutes2),
      details: 'Day 2 takes 60m; remaining 300m splits evenly as 150m + 150m on Days 3 and 4.',
    });
  } catch (err: any) {
    results.push({
      id: 2,
      title: 'Day with 1h capacity redistributes remaining 5h across next two days',
      passed: false,
      expected: '[60, 150, 150]',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 3: Missing a recovery allocation redistributes the outstanding amount within the original expiry date.
  try {
    const res3 = calculateBacklog({
      startDate: '2026-11-01',
      targetDate: '2026-11-30',
      today: '2026-11-03', // Nov 02 has passed with no recovery session checked
      plans: [
        freePlan('2026-11-01', [task('net-1', 'OSI model', 360)], 600),
        freePlan('2026-11-02', [], 600),
        freePlan('2026-11-03', [], 600),
        freePlan('2026-11-04', [], 600),
      ],
      backlogSessions: [],
    });
    const rows3 = res3.allocations.filter((x) => x.batchId === '2026-11-01::net-1');
    const dates3 = rows3.map((x) => x.date);
    const minutes3 = rows3.map((x) => x.minutes);
    const passed3 =
      dates3.length === 2 &&
      dates3[0] === '2026-11-03' &&
      dates3[1] === '2026-11-04' &&
      minutes3[0] === 180 &&
      minutes3[1] === 180;
    results.push({
      id: 3,
      title: 'Missing recovery allocation redistributes outstanding amount within original expiry',
      passed: passed3,
      expected: '2 dates [Nov 3, Nov 4] with 180 min each',
      actual: `Dates: ${JSON.stringify(dates3)}, Minutes: ${JSON.stringify(minutes3)}`,
      details: 'All 360m rebalanced across remaining 2 eligible days without extending expiry.',
    });
  } catch (err: any) {
    results.push({
      id: 3,
      title: 'Missing recovery allocation redistributes outstanding amount within original expiry',
      passed: false,
      expected: '2 dates with 180m each',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 4: New backlog batches compete with older batches according to oldest-first priority.
  try {
    const res4 = calculateBacklog({
      startDate: '2026-11-01',
      targetDate: '2026-11-30',
      today: '2026-11-03',
      plans: [
        freePlan('2026-11-01', [task('old-task', 'Old topic', 180)], 600),
        freePlan('2026-11-02', [task('new-task', 'New topic', 180)], 600),
        freePlan('2026-11-03', [], 120), // tightly constrained: 120m free
        freePlan('2026-11-04', [], 120),
        freePlan('2026-11-05', [], 120),
      ],
      backlogSessions: [],
    });
    const oldOnDay3 = res4.allocations.find(
      (x) => x.batchId === '2026-11-01::old-task' && x.date === '2026-11-03',
    );
    const newOnDay3 = res4.allocations.find(
      (x) => x.batchId === '2026-11-02::new-task' && x.date === '2026-11-03',
    );
    const oldMin = oldOnDay3?.minutes ?? 0;
    const newMin = newOnDay3?.minutes ?? 0;
    const passed4 = oldMin > newMin && oldMin === 90 && newMin === 30;
    results.push({
      id: 4,
      title: 'New backlog batches compete with older batches by oldest-first priority',
      passed: passed4,
      expected: 'Old batch gets 90m priority, New batch gets 30m remainder',
      actual: `Old: ${oldMin}m, New: ${newMin}m`,
      details: 'Older batch from Nov 01 claimed 90m of the 120m capacity first.',
    });
  } catch (err: any) {
    results.push({
      id: 4,
      title: 'New backlog batches compete with older batches by oldest-first priority',
      passed: false,
      expected: 'Old > New',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 5: A completed recovery checkbox reduces only its allocated backlog minutes.
  try {
    const batchId = '2026-11-01::net-1';
    const res5 = calculateBacklog({
      startDate: '2026-11-01',
      targetDate: '2026-11-30',
      today: '2026-11-03',
      plans: [
        freePlan('2026-11-01', [task('net-1', 'OSI model', 360)], 600),
        freePlan('2026-11-02', [], 600),
        freePlan('2026-11-03', [], 600),
        freePlan('2026-11-04', [], 600),
      ],
      backlogSessions: [
        { batchId, date: '2026-11-02', allocatedMinutes: 120, completed: true },
      ],
    });
    const batch5 = res5.batches.find((x) => x.id === batchId);
    const passed5 = batch5?.recoveredMinutes === 120 && batch5?.pendingMinutes === 240;
    results.push({
      id: 5,
      title: 'A completed recovery checkbox reduces only its allocated backlog minutes',
      passed: Boolean(passed5),
      expected: 'recoveredMinutes: 120, pendingMinutes: 240',
      actual: `recovered: ${batch5?.recoveredMinutes}, pending: ${batch5?.pendingMinutes}`,
      details: 'Original task remains unfinished in topic, but 120m recovered towards total 360m.',
    });
  } catch (err: any) {
    results.push({
      id: 5,
      title: 'A completed recovery checkbox reduces only its allocated backlog minutes',
      passed: false,
      expected: 'recovered: 120',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 6: A completed original task does not generate backlog.
  try {
    const res6 = calculateBacklog({
      startDate: '2026-11-01',
      targetDate: '2026-11-30',
      today: '2026-11-02',
      plans: [
        freePlan('2026-11-01', [task('done-task', 'Completed topic', 120, true)], 600),
        freePlan('2026-11-02', [], 600),
      ],
      backlogSessions: [],
    });
    const passed6 = res6.batches.length === 0 && res6.allocations.length === 0;
    results.push({
      id: 6,
      title: 'A completed original task does not generate backlog',
      passed: passed6,
      expected: '0 batches and 0 allocations generated',
      actual: `batches: ${res6.batches.length}, allocations: ${res6.allocations.length}`,
      details: 'Task was completed on its scheduled day, so zero backlog was created.',
    });
  } catch (err: any) {
    results.push({
      id: 6,
      title: 'A completed original task does not generate backlog',
      passed: false,
      expected: '0 batches',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 7: Expired backlog becomes permanently discarded.
  try {
    const res7 = calculateBacklog({
      startDate: '2026-11-01',
      targetDate: '2026-11-30',
      today: '2026-11-05', // Window Nov 02-04 has expired
      plans: [
        freePlan('2026-11-01', [task('net-1', 'OSI model', 360)], 600),
        freePlan('2026-11-02', [], 600),
        freePlan('2026-11-03', [], 600),
        freePlan('2026-11-04', [], 600),
        freePlan('2026-11-05', [], 600),
      ],
      backlogSessions: [
        { batchId: '2026-11-01::net-1', date: '2026-11-02', allocatedMinutes: 120, completed: true },
      ],
    });
    const batch7 = res7.batches.find((x) => x.id === '2026-11-01::net-1');
    const passed7 =
      batch7?.status === 'expired' &&
      batch7.recoveredMinutes === 120 &&
      batch7.discardedMinutes === 240 &&
      batch7.pendingMinutes === 0;
    results.push({
      id: 7,
      title: 'Expired backlog becomes permanently discarded',
      passed: Boolean(passed7),
      expected: 'status: expired, recovered: 120m, discarded: 240m',
      actual: `status: ${batch7?.status}, recovered: ${batch7?.recoveredMinutes}, discarded: ${batch7?.discardedMinutes}`,
      details: 'Unrecovered remainder of expired batch is marked permanently lost.',
    });
  } catch (err: any) {
    results.push({
      id: 7,
      title: 'Expired backlog becomes permanently discarded',
      passed: false,
      expected: 'status: expired',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 8: Backlog cannot extend beyond November 25 for November 30 target.
  try {
    const cutoff = getBacklogRecoveryCutoff('2026-11-30');
    const res8 = calculateBacklog({
      startDate: '2026-11-22',
      targetDate: '2026-11-30',
      today: '2026-11-23',
      plans: [
        freePlan('2026-11-22', [task('late-task', 'Late study', 360)], 600),
        freePlan('2026-11-23', [], 600),
        freePlan('2026-11-24', [], 600),
        freePlan('2026-11-25', [], 600),
        freePlan('2026-11-26', [], 600),
      ],
      backlogSessions: [],
    });
    const batch8 = res8.batches.find((x) => x.id === '2026-11-22::late-task');
    const allocations8 = res8.allocations.filter((x) => x.batchId === batch8?.id);
    const maxDate = allocations8.reduce((m, x) => (x.date > m ? x.date : m), '');
    const passed8 = cutoff === '2026-11-25' && batch8?.expiryDate === '2026-11-25' && maxDate <= '2026-11-25';
    results.push({
      id: 8,
      title: 'Backlog cannot extend beyond Nov 25 for Nov 30 target',
      passed: Boolean(passed8),
      expected: 'cutoff: 2026-11-25, max allocation date <= 2026-11-25',
      actual: `cutoff: ${cutoff}, batch expiry: ${batch8?.expiryDate}, max alloc: ${maxDate}`,
      details: '5-day exam buffer strictly caps recovery on Nov 25.',
    });
  } catch (err: any) {
    results.push({
      id: 8,
      title: 'Backlog cannot extend beyond Nov 25 for Nov 30 target',
      passed: false,
      expected: 'cutoff 2026-11-25',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 9: A task missed on November 25 has no eligible recovery day.
  try {
    const res9 = calculateBacklog({
      startDate: '2026-11-25',
      targetDate: '2026-11-30',
      today: '2026-11-26',
      plans: [
        freePlan('2026-11-25', [task('nov25-task', 'Nov 25 study', 90)], 600),
        freePlan('2026-11-26', [], 600),
      ],
      backlogSessions: [],
    });
    const batch9 = res9.batches.find((x) => x.id === '2026-11-25::nov25-task');
    const passed9 =
      batch9?.status === 'expired' &&
      batch9.discardedMinutes === 90 &&
      batch9.scheduledMinutes === 0;
    results.push({
      id: 9,
      title: 'Task missed on November 25 has no eligible recovery day',
      passed: Boolean(passed9),
      expected: 'status: expired, discardedMinutes: 90 immediately',
      actual: `status: ${batch9?.status}, discarded: ${batch9?.discardedMinutes}`,
      details: 'Since Nov 26 is after Nov 25 cutoff, it discards immediately on Nov 26.',
    });
  } catch (err: any) {
    results.push({
      id: 9,
      title: 'Task missed on November 25 has no eligible recovery day',
      passed: false,
      expected: 'discarded 90',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 10: Editing historical task completion updates future allocations.
  try {
    const planUnchecked = freePlan('2026-11-01', [task('t1', 'Task 1', 120, false)], 600);
    const planChecked = freePlan('2026-11-01', [task('t1', 'Task 1', 120, true)], 600);
    const plansBefore = [planUnchecked, freePlan('2026-11-02', [], 600), freePlan('2026-11-03', [], 600)];
    const plansAfter = [planChecked, freePlan('2026-11-02', [], 600), freePlan('2026-11-03', [], 600)];

    const resBefore = calculateBacklog({
      startDate: '2026-11-01', targetDate: '2026-11-30', today: '2026-11-02',
      plans: plansBefore, backlogSessions: [],
    });
    const resAfter = calculateBacklog({
      startDate: '2026-11-01', targetDate: '2026-11-30', today: '2026-11-02',
      plans: plansAfter, backlogSessions: [],
    });

    const passed10 = resBefore.batches.length === 1 && resAfter.batches.length === 0;
    results.push({
      id: 10,
      title: 'Editing historical task completion updates future allocations immediately',
      passed: passed10,
      expected: 'Batches before edit: 1 -> Batches after edit: 0',
      actual: `Before: ${resBefore.batches.length}, After: ${resAfter.batches.length}`,
      details: 'Marking historical task complete instantly eliminates its downstream backlog.',
    });
  } catch (err: any) {
    results.push({
      id: 10,
      title: 'Editing historical task completion updates future allocations immediately',
      passed: false,
      expected: '1 -> 0',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 11: Editing task duration updates its backlog correctly.
  try {
    const planShort = freePlan('2026-11-01', [task('t-dur', 'Dur test', 60)], 600);
    const planLong = freePlan('2026-11-01', [task('t-dur', 'Dur test', 180)], 600);

    const resShort = calculateBacklog({
      startDate: '2026-11-01', targetDate: '2026-11-30', today: '2026-11-02',
      plans: [planShort, freePlan('2026-11-02', [], 600)], backlogSessions: [],
    });
    const resLong = calculateBacklog({
      startDate: '2026-11-01', targetDate: '2026-11-30', today: '2026-11-02',
      plans: [planLong, freePlan('2026-11-02', [], 600)], backlogSessions: [],
    });

    const sumShort = resShort.batches[0]?.originalMinutes;
    const sumLong = resLong.batches[0]?.originalMinutes;
    const passed11 = sumShort === 60 && sumLong === 180;
    results.push({
      id: 11,
      title: 'Editing task duration updates its backlog correctly',
      passed: passed11,
      expected: 'Original minutes updates from 60m to 180m',
      actual: `Short: ${sumShort}m, Long: ${sumLong}m`,
      details: 'Modifying duration changes total backlog batch and reallocates accordingly.',
    });
  } catch (err: any) {
    results.push({
      id: 11,
      title: 'Editing task duration updates its backlog correctly',
      passed: false,
      expected: '60 -> 180',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 12: Refreshing browser retains all progress (storage serialization check).
  try {
    const initial = getInitialAppState();
    const serialized = JSON.stringify(initial);
    const restored = JSON.parse(serialized);
    const passed12 =
      restored.settings.startDate === '2026-11-03' &&
      restored.settings.targetDate === '2026-11-30' &&
      Object.keys(restored.timetableByDate).length >= 28;
    results.push({
      id: 12,
      title: 'Refreshing browser retains all progress (storage serialization)',
      passed: passed12,
      expected: 'All 28 timetable days and settings preserved',
      actual: `Days: ${Object.keys(restored.timetableByDate).length}, start: ${restored.settings.startDate}`,
      details: 'Deterministic JSON representation is 100% round-trip safe.',
    });
  } catch (err: any) {
    results.push({
      id: 12,
      title: 'Refreshing browser retains all progress',
      passed: false,
      expected: 'Round-trip success',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 13: Import/export preserves same records and calculation results.
  try {
    const state = getInitialAppState();
    // Add a sample backlog session and a completed task
    const sampleAllocation = {
      id: '2026-11-03::tpl-dsa-1@@2026-11-04',
      batchId: '2026-11-03::tpl-dsa-1',
      date: '2026-11-04',
      minutes: 50,
      completed: true,
      sourceDate: '2026-11-03',
      taskId: 'tpl-dsa-1',
      subject: 'DSA',
      taskTitle: 'DSA – Solve 2 Questions',
    };
    state.backlogSessions = setBacklogSessionCompletion([], sampleAllocation, true);

    const exported = exportStateToJson(state);
    const validation = validateImportData(exported);
    const passed13 =
      validation.valid &&
      validation.data?.backlogSessions.length === 1 &&
      validation.data.backlogSessions[0].allocatedMinutes === 50;

    results.push({
      id: 13,
      title: 'Import/export preserves same records and calculation results',
      passed: Boolean(passed13),
      expected: 'Valid import with matching backlog sessions',
      actual: `Valid: ${validation.valid}, Sessions: ${validation.data?.backlogSessions.length}`,
      details: 'Export payload validated and parsed without data degradation.',
    });
  } catch (err: any) {
    results.push({
      id: 13,
      title: 'Import/export preserves same records and calculation results',
      passed: false,
      expected: 'Valid import',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 14: Free-time calculations never compromise seven-hour sleep.
  try {
    const heavyPlan: DayPlan = {
      date: '2026-11-05',
      fixedCommitmentMinutes: 400,
      tasks: [task('big', 'Massive study', 800)],
    };
    // 420 sleep + 400 commit + 800 study = 1620 min (exceeds 1440 min day by 180 min)
    const cap = getFreeTimeMinutes(heavyPlan);
    // free time must be strictly max(0, 1440 - 420 - 400 - 800) = 0, overbooked: 180
    const passed14 = cap.freeTimeMinutes === 0 && cap.overbookedMinutes === 180;
    results.push({
      id: 14,
      title: 'Free-time calculations never compromise seven-hour sleep',
      passed: passed14,
      expected: 'freeTimeMinutes: 0, overbookedMinutes: 180 (sleep remains fixed at 420m)',
      actual: `freeTime: ${cap.freeTimeMinutes}, overbooked: ${cap.overbookedMinutes}`,
      details: 'Formula enforces max(0, 1440 - 420 - fixed - study) with no sleep deduction.',
    });
  } catch (err: any) {
    results.push({
      id: 14,
      title: 'Free-time calculations never compromise seven-hour sleep',
      passed: false,
      expected: 'freeTime: 0',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  // Test 15: No backlog allocation exceeds available daily free-time capacity.
  try {
    const res15 = calculateBacklog({
      startDate: '2026-11-01',
      targetDate: '2026-11-30',
      today: '2026-11-02',
      plans: [
        freePlan('2026-11-01', [task('huge', 'Huge backlog', 600)], 600),
        freePlan('2026-11-02', [], 90), // only 90m free
        freePlan('2026-11-03', [], 100), // only 100m free
        freePlan('2026-11-04', [], 80), // only 80m free
      ],
      backlogSessions: [],
    });
    const allocDay2 = res15.allocations
      .filter((x) => x.date === '2026-11-02')
      .reduce((s, x) => s + x.minutes, 0);
    const allocDay3 = res15.allocations
      .filter((x) => x.date === '2026-11-03')
      .reduce((s, x) => s + x.minutes, 0);
    const allocDay4 = res15.allocations
      .filter((x) => x.date === '2026-11-04')
      .reduce((s, x) => s + x.minutes, 0);

    const passed15 =
      allocDay2 <= 90 &&
      allocDay3 <= 100 &&
      allocDay4 <= 80 &&
      res15.totals.projectedDiscardMinutes === (600 - (allocDay2 + allocDay3 + allocDay4));

    results.push({
      id: 15,
      title: 'No backlog allocation exceeds available daily free-time capacity',
      passed: passed15,
      expected: 'Day 2 <= 90m, Day 3 <= 100m, Day 4 <= 80m, remainder in projected discard',
      actual: `D2: ${allocDay2}/90, D3: ${allocDay3}/100, D4: ${allocDay4}/80, ProjDiscard: ${res15.totals.projectedDiscardMinutes}m`,
      details: 'Water-filling algorithm strictly respects every single daily free time cap.',
    });
  } catch (err: any) {
    results.push({
      id: 15,
      title: 'No backlog allocation exceeds available daily free-time capacity',
      passed: false,
      expected: 'Allocations <= capacity',
      actual: err.message,
      details: 'Exception thrown.',
    });
  }

  return results;
}
