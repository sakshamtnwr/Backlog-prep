# Study backlog engine

`backlogEngine.ts` is the deterministic calculation layer for a personal study planner. It has no AI, API, database, or UI dependency.

## Core input

- `startDate`, `targetDate`, and `today`: `YYYY-MM-DD` local calendar dates.
- `plans`: one `DayPlan` per calendar date. Include fixed commitments and all original planned study tasks.
- `backlogSessions`: saved recovery checkbox records. A completed record stores the exact number of minutes shown when the user checked it.

Durations are integer minutes. Sleep is fixed at 420 minutes.

## Important behavior

- An incomplete task from a past date creates a backlog batch.
- The batch can recover on the following three calendar days, limited by `targetDate - 5 days` (inclusive).
- Batches are prioritized by oldest source date; tasks from the same date use their order in the plan.
- Each batch is spread as evenly as possible over its remaining dates, subject to each date's free-time capacity. Capacity-limited minutes are redistributed over the dates that remain.
- A missed recovery allocation is not recovered. On the next day, the batch is rebalanced within its original expiry date.
- A checked recovery session recovers only its saved allocation minutes; it does not automatically complete the original topic or another task.
- `projectedDiscardMinutes` means the current plan has no slot for those minutes. It is a forecast and can change if a future day plan changes.
- `discardedMinutes` is permanent: it appears only after the batch's recovery window has closed (or the batch has no recovery day because of the target cutoff).
- If a date has no `DayPlan`, its free-time capacity is conservatively treated as zero and its date is returned in `missingPlanDates`.

## Integration sketch

```ts
const result = calculateBacklog({
  startDate,
  targetDate,
  today: getLocalTodayKey(),
  plans,
  backlogSessions,
});

// Render today's recovery blocks:
const todaysBlocks = result.allocations.filter(
  (block) => block.date === getLocalTodayKey(),
);

// When a user checks a block, persist the returned updated array:
const updatedSessions = setBacklogSessionCompletion(
  backlogSessions,
  allocation,
  true,
);
```

Persist `plans` and `backlogSessions` in localStorage. Export/import those two arrays plus `startDate` and `targetDate` as JSON.

## Run the checks

With Node.js and TypeScript installed:

```bash
tsc backlogEngine.ts --target ES2020 --module commonjs --strict --outDir dist
node backlogEngine.test.mjs
```

The test file covers equal distribution, low-capacity redistribution, missed recovery days, oldest-first priority, checked recovery blocks, expiry, the inclusive target cutoff, and projected versus permanent discard.
