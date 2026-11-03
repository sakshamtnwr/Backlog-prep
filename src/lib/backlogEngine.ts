/**
 * Deterministic study-backlog engine.
 *
 * Core rules:
 * - A missed daily task creates its own backlog batch on the following day.
 * - A batch can be recovered on the next 3 calendar days, inclusive.
 * - The overall recovery cutoff is targetDate - 5 days (inclusive).
 * - Older batches get first claim on free-time capacity.
 * - Within its remaining window, each batch is spread as evenly as possible.
 * - If a day has insufficient capacity, the overflow is redistributed over
 *   the batch's remaining days. Missed allocations are not counted as recovered.
 * - A recovery checkbox completes that day's allocated block only. It does not
 *   automatically complete the original topic or any other task.
 * - Any unrecovered amount is permanently discarded after its recovery window.
 *
 * Store all durations as integer minutes. Do not use floating-point hours.
 */

export type DateKey = string; // YYYY-MM-DD

export const DAY_MINUTES = 24 * 60;
export const SLEEP_MINUTES = 7 * 60; // Protected: never reduce this.
export const RECOVERY_WINDOW_DAYS = 3;
export const TARGET_BUFFER_DAYS = 5;

export interface StudyTask {
  id: string; // Stable ID; do not regenerate when editing a task.
  title: string;
  subject: string;
  durationMinutes: number;
  completed: boolean;
}

export interface DayPlan {
  date: DateKey;
  /** Classes, work, meals, commute, appointments, and other fixed commitments. */
  fixedCommitmentMinutes: number;
  tasks: StudyTask[];
}

/**
 * A saved recovery checkbox/session.
 * Save a record when a user marks a recovery allocation complete or incomplete.
 * `allocatedMinutes` is a snapshot of the block shown when the checkbox was used.
 * Future allocations are recalculated; past session snapshots remain historical.
 */
export interface BacklogSession {
  batchId: string;
  date: DateKey;
  allocatedMinutes: number;
  completed: boolean;
}

export interface BacklogEngineInput {
  startDate: DateKey;
  targetDate: DateKey;
  today: DateKey;
  plans: DayPlan[];
  backlogSessions: BacklogSession[];
}

export interface BacklogAllocation {
  id: string;
  batchId: string;
  sourceDate: DateKey;
  taskId: string;
  subject: string;
  taskTitle: string;
  date: DateKey;
  minutes: number;
  completed: boolean;
}

export interface BacklogBatchSummary {
  id: string;
  sourceDate: DateKey;
  recoveryStartDate: DateKey;
  expiryDate: DateKey;
  taskId: string;
  subject: string;
  taskTitle: string;
  originalMinutes: number;
  recoveredMinutes: number;
  pendingMinutes: number;
  /** Uncompleted blocks currently placed into today/future dates. */
  scheduledMinutes: number;
  /** Pending minutes that do not currently fit into any remaining free-time slot. */
  projectedDiscardMinutes: number;
  /** Permanent loss: only set once the recovery window has closed. */
  discardedMinutes: number;
  status: "active" | "completed" | "expired";
}

export interface DayCapacitySummary {
  date: DateKey;
  plannedStudyMinutes: number;
  fixedCommitmentMinutes: number;
  sleepMinutes: number;
  freeTimeMinutes: number;
  baseScheduleOverbookedMinutes: number;
  backlogMinutes: number;
  remainingFreeTimeMinutes: number;
  /** Non-zero if saved completed recovery blocks exceed today's recalculated free time. */
  completedBlockOverrunMinutes: number;
  /** True when no day plan exists; capacity is conservatively treated as zero. */
  planMissing: boolean;
}

export interface BacklogEngineResult {
  recoveryCutoffDate: DateKey;
  currentDayNumber: number;
  /** Counts today when today is on/before targetDate. */
  daysRemainingIncludingToday: number;
  allocations: BacklogAllocation[];
  batches: BacklogBatchSummary[];
  dayCapacity: DayCapacitySummary[];
  totals: {
    generatedMinutes: number;
    recoveredMinutes: number;
    pendingMinutes: number;
    scheduledMinutes: number;
    projectedDiscardMinutes: number;
    discardedMinutes: number;
  };
  missingPlanDates: DateKey[];
}

interface InternalBatch {
  id: string;
  sourceDate: DateKey;
  recoveryStartDate: DateKey;
  expiryDate: DateKey;
  taskId: string;
  taskIndex: number;
  subject: string;
  taskTitle: string;
  totalMinutes: number;
  hasRecoveryWindow: boolean;
}

function assertMinutes(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer number of minutes.`);
  }
}

function parseDateKey(value: DateKey): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid date '${value}'. Expected YYYY-MM-DD.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date '${value}'.`);
  }
  return date;
}

function toDateKey(date: Date): DateKey {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: DateKey, amount: number): DateKey {
  const parsed = parseDateKey(date);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return toDateKey(parsed);
}

export function daysBetween(from: DateKey, to: DateKey): number {
  return (parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000;
}

function minDate(a: DateKey, b: DateKey): DateKey {
  return a <= b ? a : b;
}

export function getLocalTodayKey(now: Date = new Date()): DateKey {
  // Use the browser's local calendar date. Avoid toISOString(), which can
  // shift the date when the browser's timezone is not UTC.
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getBacklogRecoveryCutoff(targetDate: DateKey): DateKey {
  // The cutoff date itself is recoverable. Example: target Nov 30 -> cutoff Nov 25.
  return addDays(targetDate, -TARGET_BUFFER_DAYS);
}

export function getFreeTimeMinutes(plan: DayPlan | undefined): {
  plannedStudyMinutes: number;
  fixedCommitmentMinutes: number;
  freeTimeMinutes: number;
  overbookedMinutes: number;
} {
  if (!plan) {
    return {
      plannedStudyMinutes: 0,
      fixedCommitmentMinutes: 0,
      freeTimeMinutes: 0,
      overbookedMinutes: 0,
    };
  }

  assertMinutes(plan.fixedCommitmentMinutes, `fixedCommitmentMinutes on ${plan.date}`);
  const plannedStudyMinutes = plan.tasks.reduce((sum, task) => {
    assertMinutes(task.durationMinutes, `durationMinutes for task ${task.id}`);
    return sum + task.durationMinutes;
  }, 0);

  const usedMinutes = SLEEP_MINUTES + plan.fixedCommitmentMinutes + plannedStudyMinutes;
  return {
    plannedStudyMinutes,
    fixedCommitmentMinutes: plan.fixedCommitmentMinutes,
    freeTimeMinutes: Math.max(0, DAY_MINUTES - usedMinutes),
    overbookedMinutes: Math.max(0, usedMinutes - DAY_MINUTES),
  };
}

export function backlogSessionKey(batchId: string, date: DateKey): string {
  return `${batchId}@@${date}`;
}

/**
 * Save/toggle one recovery checkbox. Use the allocation object returned by
 * calculateBacklog(), so the exact displayed minutes are saved as a snapshot.
 */
export function setBacklogSessionCompletion(
  sessions: BacklogSession[],
  allocation: BacklogAllocation,
  completed: boolean,
): BacklogSession[] {
  const key = backlogSessionKey(allocation.batchId, allocation.date);
  const next = sessions.filter(
    (session) => backlogSessionKey(session.batchId, session.date) !== key,
  );
  next.push({
    batchId: allocation.batchId,
    date: allocation.date,
    allocatedMinutes: allocation.minutes,
    completed,
  });
  return next;
}

function makeBatches(input: BacklogEngineInput, cutoffDate: DateKey): InternalBatch[] {
  const batches: InternalBatch[] = [];
  const sortedPlans = [...input.plans].sort((a, b) => a.date.localeCompare(b.date));

  for (const plan of sortedPlans) {
    parseDateKey(plan.date);
    if (plan.date < input.startDate || plan.date >= input.today) continue;

    plan.tasks.forEach((task, taskIndex) => {
      assertMinutes(task.durationMinutes, `durationMinutes for task ${task.id}`);
      if (task.completed || task.durationMinutes === 0) return;

      const recoveryStartDate = addDays(plan.date, 1);
      const naturalExpiryDate = addDays(plan.date, RECOVERY_WINDOW_DAYS);
      const expiryDate = minDate(naturalExpiryDate, cutoffDate);

      batches.push({
        id: `${plan.date}::${task.id}`,
        sourceDate: plan.date,
        recoveryStartDate,
        expiryDate,
        taskId: task.id,
        taskIndex,
        subject: task.subject,
        taskTitle: task.title,
        totalMinutes: task.durationMinutes,
        hasRecoveryWindow: recoveryStartDate <= expiryDate,
      });
    });
  }

  // Oldest source date first. For tasks missed on the same date, preserve the
  // order in which they appear in that day's plan. The ID is a stable tie-breaker.
  return batches.sort(
    (a, b) =>
      a.sourceDate.localeCompare(b.sourceDate) ||
      a.taskIndex - b.taskIndex ||
      a.id.localeCompare(b.id),
  );
}

function validCompletedMinutes(
  batch: InternalBatch,
  sessions: Map<string, BacklogSession>,
  beforeDate: DateKey,
): number {
  const eligible = [...sessions.values()]
    .filter(
      (session) =>
        session.batchId === batch.id &&
        session.completed &&
        session.date >= batch.recoveryStartDate &&
        session.date <= batch.expiryDate &&
        session.date < beforeDate,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  let recovered = 0;
  for (const session of eligible) {
    if (recovered >= batch.totalMinutes) break;
    assertMinutes(session.allocatedMinutes, `allocatedMinutes for ${batch.id} on ${session.date}`);
    recovered += Math.min(session.allocatedMinutes, batch.totalMinutes - recovered);
  }
  return recovered;
}

/**
 * Capacity-aware equal distribution (water-filling).
 *
 * Example: 6h across 3 days, but day 1 has only 1h capacity ->
 * 1h, 2.5h, 2.5h. If a later day also has a limit, the overflow is
 * redistributed again across the remaining days that still have capacity.
 *
 * `remainingCapacity` is mutated so older batches reserve capacity before
 * newer batches are processed.
 */
function distributeEvenly(
  totalMinutes: number,
  dates: DateKey[],
  remainingCapacity: Map<DateKey, number>,
): Map<DateKey, number> {
  const allocations = new Map<DateKey, number>();
  let remaining = totalMinutes;
  let activeDates = dates.filter((date) => (remainingCapacity.get(date) ?? 0) > 0);

  while (remaining > 0 && activeDates.length > 0) {
    const baseShare = Math.floor(remaining / activeDates.length);
    const extraMinutes = remaining % activeDates.length;
    const proposed = activeDates.map((date, index) => ({
      date,
      share: baseShare + (index < extraMinutes ? 1 : 0),
      capacity: remainingCapacity.get(date) ?? 0,
    }));

    const saturated = proposed.filter((item) => item.capacity < item.share);

    if (saturated.length === 0) {
      for (const item of proposed) {
        if (item.share <= 0) continue;
        allocations.set(item.date, (allocations.get(item.date) ?? 0) + item.share);
        remainingCapacity.set(item.date, item.capacity - item.share);
        remaining -= item.share;
      }
      break;
    }

    const saturatedDates = new Set<DateKey>();
    for (const item of saturated) {
      const take = item.capacity;
      if (take > 0) {
        allocations.set(item.date, (allocations.get(item.date) ?? 0) + take);
        remaining -= take;
      }
      remainingCapacity.set(item.date, 0);
      saturatedDates.add(item.date);
    }
    activeDates = activeDates.filter((date) => !saturatedDates.has(date));
  }

  return allocations;
}

export function calculateBacklog(input: BacklogEngineInput): BacklogEngineResult {
  parseDateKey(input.startDate);
  parseDateKey(input.targetDate);
  parseDateKey(input.today);
  if (input.targetDate < input.startDate) {
    throw new Error("targetDate cannot be earlier than startDate.");
  }

  const cutoffDate = getBacklogRecoveryCutoff(input.targetDate);
  const planByDate = new Map<DateKey, DayPlan>();
  for (const plan of input.plans) {
    parseDateKey(plan.date);
    if (planByDate.has(plan.date)) {
      throw new Error(`More than one DayPlan was supplied for ${plan.date}.`);
    }
    planByDate.set(plan.date, plan);
    // Validate the plan even if it is not used for today's allocation.
    getFreeTimeMinutes(plan);
  }

  const sessionByKey = new Map<string, BacklogSession>();
  for (const session of input.backlogSessions) {
    parseDateKey(session.date);
    assertMinutes(session.allocatedMinutes, `allocatedMinutes for ${session.batchId}`);
    sessionByKey.set(backlogSessionKey(session.batchId, session.date), session);
  }

  const batches = makeBatches(input, cutoffDate);
  const allocations: BacklogAllocation[] = [];
  const batchSummaries: BacklogBatchSummary[] = [];
  const missingPlanDates: DateKey[] = [];

  // Only dates from today through the inclusive recovery cutoff can receive
  // backlog. Missing day plans get zero capacity rather than guessed capacity.
  const capacityByDate = new Map<DateKey, number>();
  const baseCapacityByDate = new Map<DateKey, ReturnType<typeof getFreeTimeMinutes>>();
  if (input.today <= cutoffDate) {
    for (let date = input.today; date <= cutoffDate; date = addDays(date, 1)) {
      const plan = planByDate.get(date);
      if (!plan) missingPlanDates.push(date);
      const capacity = getFreeTimeMinutes(plan);
      baseCapacityByDate.set(date, capacity);
      capacityByDate.set(date, capacity.freeTimeMinutes);
    }
  }

  const activeBatches: InternalBatch[] = [];
  const todayCompletedByBatch = new Map<string, number>();
  const todaySessionMinutesByBatch = new Map<string, number>();

  // First pass: determine which batches have expired and preserve completed
  // recovery sessions from history. Sessions after a batch's expiry never count.
  for (const batch of batches) {
    if (!batch.hasRecoveryWindow) {
      batchSummaries.push({
        id: batch.id,
        sourceDate: batch.sourceDate,
        recoveryStartDate: batch.recoveryStartDate,
        expiryDate: batch.expiryDate,
        taskId: batch.taskId,
        subject: batch.subject,
        taskTitle: batch.taskTitle,
        originalMinutes: batch.totalMinutes,
        recoveredMinutes: 0,
        pendingMinutes: 0,
        scheduledMinutes: 0,
        projectedDiscardMinutes: 0,
        discardedMinutes: batch.totalMinutes,
        status: "expired",
      });
      continue;
    }

    if (batch.expiryDate < input.today) {
      const recovered = validCompletedMinutes(batch, sessionByKey, addDays(batch.expiryDate, 1));
      const discarded = Math.max(0, batch.totalMinutes - recovered);
      batchSummaries.push({
        id: batch.id,
        sourceDate: batch.sourceDate,
        recoveryStartDate: batch.recoveryStartDate,
        expiryDate: batch.expiryDate,
        taskId: batch.taskId,
        subject: batch.subject,
        taskTitle: batch.taskTitle,
        originalMinutes: batch.totalMinutes,
        recoveredMinutes: recovered,
        pendingMinutes: 0,
        scheduledMinutes: 0,
        projectedDiscardMinutes: 0,
        discardedMinutes: discarded,
        status: "expired",
      });
      continue;
    }

    activeBatches.push(batch);
  }

  // Pre-pass: today's already-completed recovery blocks have physically used
  // free time. Reserve that capacity before allocating anything else today.
  for (const batch of activeBatches) {
    const key = backlogSessionKey(batch.id, input.today);
    const todaySession = sessionByKey.get(key);
    if (!todaySession?.completed) continue;

    const rawMinutes = todaySession.allocatedMinutes;
    todaySessionMinutesByBatch.set(batch.id, rawMinutes);
    const recoveredBefore = validCompletedMinutes(batch, sessionByKey, input.today);
    const recoverableToday = Math.min(
      rawMinutes,
      Math.max(0, batch.totalMinutes - recoveredBefore),
    );
    todayCompletedByBatch.set(batch.id, recoverableToday);

    if (capacityByDate.has(input.today)) {
      const currentCapacity = capacityByDate.get(input.today) ?? 0;
      capacityByDate.set(input.today, Math.max(0, currentCapacity - rawMinutes));
    }

    if (rawMinutes > 0) {
      allocations.push({
        id: backlogSessionKey(batch.id, input.today),
        batchId: batch.id,
        sourceDate: batch.sourceDate,
        taskId: batch.taskId,
        subject: batch.subject,
        taskTitle: batch.taskTitle,
        date: input.today,
        minutes: rawMinutes,
        completed: true,
      });
    }
  }

  // Second pass: oldest backlog batch receives first claim on all remaining
  // free-time slots in its recovery window. Newer batches use what remains.
  for (const batch of activeBatches) {
    const recoveredBeforeToday = validCompletedMinutes(batch, sessionByKey, input.today);
    const recoveredToday = todayCompletedByBatch.get(batch.id) ?? 0;
    const recovered = Math.min(batch.totalMinutes, recoveredBeforeToday + recoveredToday);
    const remaining = Math.max(0, batch.totalMinutes - recovered);

    let scheduledMinutes = 0;
    let projectedDiscardMinutes = 0;

    if (remaining > 0) {
      const alreadyCompletedToday = (todaySessionMinutesByBatch.get(batch.id) ?? 0) > 0;
      const distributionStart = alreadyCompletedToday ? addDays(input.today, 1) : input.today;
      const eligibleDates: DateKey[] = [];

      if (distributionStart <= batch.expiryDate) {
        for (
          let date = distributionStart;
          date <= batch.expiryDate;
          date = addDays(date, 1)
        ) {
          eligibleDates.push(date);
        }
      }

      const batchAllocations = distributeEvenly(remaining, eligibleDates, capacityByDate);
      for (const [date, minutes] of batchAllocations) {
        if (minutes <= 0) continue;
        scheduledMinutes += minutes;
        allocations.push({
          id: backlogSessionKey(batch.id, date),
          batchId: batch.id,
          sourceDate: batch.sourceDate,
          taskId: batch.taskId,
          subject: batch.subject,
          taskTitle: batch.taskTitle,
          date,
          minutes,
          completed: false,
        });
      }
      projectedDiscardMinutes = Math.max(0, remaining - scheduledMinutes);
    }

    batchSummaries.push({
      id: batch.id,
      sourceDate: batch.sourceDate,
      recoveryStartDate: batch.recoveryStartDate,
      expiryDate: batch.expiryDate,
      taskId: batch.taskId,
      subject: batch.subject,
      taskTitle: batch.taskTitle,
      originalMinutes: batch.totalMinutes,
      recoveredMinutes: recovered,
      pendingMinutes: remaining,
      scheduledMinutes,
      projectedDiscardMinutes,
      discardedMinutes: 0,
      status: remaining === 0 ? "completed" : "active",
    });
  }

  allocations.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.sourceDate.localeCompare(b.sourceDate) ||
      a.taskTitle.localeCompare(b.taskTitle),
  );
  batchSummaries.sort(
    (a, b) =>
      a.sourceDate.localeCompare(b.sourceDate) ||
      a.taskTitle.localeCompare(b.taskTitle),
  );

  const allocationMinutesByDate = new Map<DateKey, number>();
  for (const allocation of allocations) {
    allocationMinutesByDate.set(
      allocation.date,
      (allocationMinutesByDate.get(allocation.date) ?? 0) + allocation.minutes,
    );
  }

  const dayCapacity: DayCapacitySummary[] = [];
  for (const [date, base] of baseCapacityByDate) {
    const allocated = allocationMinutesByDate.get(date) ?? 0;
    const planMissing = !planByDate.has(date);
    const completedBlockOverrunMinutes = Math.max(0, allocated - base.freeTimeMinutes);
    dayCapacity.push({
      date,
      plannedStudyMinutes: base.plannedStudyMinutes,
      fixedCommitmentMinutes: base.fixedCommitmentMinutes,
      sleepMinutes: SLEEP_MINUTES,
      freeTimeMinutes: base.freeTimeMinutes,
      baseScheduleOverbookedMinutes: base.overbookedMinutes,
      backlogMinutes: allocated,
      remainingFreeTimeMinutes: Math.max(0, base.freeTimeMinutes - allocated),
      completedBlockOverrunMinutes,
      planMissing,
    });
  }

  const generatedMinutes = batches.reduce((sum, batch) => sum + batch.totalMinutes, 0);
  const recoveredMinutes = batchSummaries.reduce((sum, batch) => sum + batch.recoveredMinutes, 0);
  const pendingMinutes = batchSummaries.reduce((sum, batch) => sum + batch.pendingMinutes, 0);
  const scheduledMinutes = batchSummaries.reduce((sum, batch) => sum + batch.scheduledMinutes, 0);
  const projectedDiscardMinutes = batchSummaries.reduce(
    (sum, batch) => sum + batch.projectedDiscardMinutes,
    0,
  );
  const discardedMinutes = batchSummaries.reduce((sum, batch) => sum + batch.discardedMinutes, 0);

  return {
    recoveryCutoffDate: cutoffDate,
    currentDayNumber: Math.max(0, daysBetween(input.startDate, input.today) + 1),
    daysRemainingIncludingToday:
      input.today <= input.targetDate ? daysBetween(input.today, input.targetDate) + 1 : 0,
    allocations,
    batches: batchSummaries,
    dayCapacity,
    totals: {
      generatedMinutes,
      recoveredMinutes,
      pendingMinutes,
      scheduledMinutes,
      projectedDiscardMinutes,
      discardedMinutes,
    },
    missingPlanDates,
  };
}

export function formatMinutes(minutes: number): string {
  assertMinutes(minutes, "minutes");
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}
