import { TimetableItem, AppSettings, AppStateData } from '../types';
import { DateKey, DayPlan, StudyTask, addDays, getBacklogRecoveryCutoff } from './backlogEngine';

export const DEFAULT_START_DATE: DateKey = '2026-11-03';
export const DEFAULT_TARGET_DATE: DateKey = '2026-11-30';
export const DEFAULT_CUTOFF_DATE: DateKey = getBacklogRecoveryCutoff(DEFAULT_TARGET_DATE); // '2026-11-25'

export const DEFAULT_SETTINGS: AppSettings = {
  startDate: DEFAULT_START_DATE,
  targetDate: DEFAULT_TARGET_DATE,
  cutoffDate: DEFAULT_CUTOFF_DATE,
  protectedSleepMinutes: 420, // 7 hours
  targetDailyStudyMinutes: 660, // 11 hours
  dismissedSleepWarning: false,
};

/**
 * Standard reusable timetable template blocks.
 * Total study = 150 + 90 + 60 + 90 + 120 + 60 + 90 = 660 min (11 hours).
 *
 * Subject distribution:
 * - DSA: 150 + 90 = 240 min (4h)
 * - Question Paper Solving: 60 + 90 + 120 = 270 min (4.5h)
 * - Revision: 60 min (1h)
 * - FastAPI: 90 min (1.5h)
 */
export const DEFAULT_TIMETABLE_TEMPLATE: TimetableItem[] = [
  {
    id: 'tpl-dsa-1',
    startTime: '06:00',
    endTime: '08:30',
    title: 'DSA – Solve 2 Questions',
    subject: 'DSA',
    durationMinutes: 150,
    isBreak: false,
  },
  {
    id: 'tpl-break-1',
    startTime: '08:30',
    endTime: '09:30',
    title: 'Break',
    subject: 'Break',
    durationMinutes: 60,
    isBreak: true,
  },
  {
    id: 'tpl-dsa-2',
    startTime: '09:30',
    endTime: '11:00',
    title: 'DSA – Solve 2 Questions',
    subject: 'DSA',
    durationMinutes: 90,
    isBreak: false,
  },
  {
    id: 'tpl-break-2',
    startTime: '11:00',
    endTime: '12:30',
    title: 'Eating Break',
    subject: 'Break',
    durationMinutes: 90,
    isBreak: true,
  },
  {
    id: 'tpl-qps-1',
    startTime: '12:30',
    endTime: '13:30',
    title: 'Question Paper Solving',
    subject: 'Question Paper Solving',
    durationMinutes: 60,
    isBreak: false,
  },
  {
    id: 'tpl-break-3',
    startTime: '13:30',
    endTime: '14:30',
    title: 'Break',
    subject: 'Break',
    durationMinutes: 60,
    isBreak: true,
  },
  {
    id: 'tpl-qps-2',
    startTime: '14:30',
    endTime: '16:00',
    title: 'Question Paper Solving',
    subject: 'Question Paper Solving',
    durationMinutes: 90,
    isBreak: false,
  },
  {
    id: 'tpl-break-4',
    startTime: '16:00',
    endTime: '17:00',
    title: 'Tea Break',
    subject: 'Break',
    durationMinutes: 60,
    isBreak: true,
  },
  {
    id: 'tpl-qps-3',
    startTime: '17:00',
    endTime: '19:00',
    title: 'Question Paper Solving',
    subject: 'Question Paper Solving',
    durationMinutes: 120,
    isBreak: false,
  },
  {
    id: 'tpl-break-5',
    startTime: '19:00',
    endTime: '20:00',
    title: 'Eating Break',
    subject: 'Break',
    durationMinutes: 60,
    isBreak: true,
  },
  {
    id: 'tpl-rev-1',
    startTime: '20:00',
    endTime: '21:00',
    title: 'Revision',
    subject: 'Revision',
    durationMinutes: 60,
    isBreak: false,
  },
  {
    id: 'tpl-break-6',
    startTime: '21:00',
    endTime: '22:30',
    title: 'Eating Break',
    subject: 'Break',
    durationMinutes: 90,
    isBreak: true,
  },
  {
    id: 'tpl-fastapi-1',
    startTime: '22:30',
    endTime: '00:00',
    title: 'FastAPI',
    subject: 'FastAPI',
    durationMinutes: 90,
    isBreak: false,
  },
];

/**
 * Creates date-specific timetable items from template with completed: false
 */
export function createItemsFromTemplate(template: TimetableItem[]): TimetableItem[] {
  return template.map((item) => ({
    ...item,
    completed: item.isBreak ? undefined : false,
  }));
}

/**
 * Generates initial application state with all dates prefilled from startDate to targetDate
 */
export function getInitialAppState(): AppStateData {
  const timetableByDate: Record<DateKey, TimetableItem[]> = {};
  const fixedCommitmentsByDate: Record<DateKey, number> = {};
  const joyTaskByDate: Record<DateKey, boolean> = {};

  let current = DEFAULT_START_DATE;
  while (current <= DEFAULT_TARGET_DATE) {
    timetableByDate[current] = createItemsFromTemplate(DEFAULT_TIMETABLE_TEMPLATE);
    fixedCommitmentsByDate[current] = 0;
    joyTaskByDate[current] = false;
    current = addDays(current, 1);
  }

  return {
    schemaVersion: 1,
    settings: { ...DEFAULT_SETTINGS },
    simulatedToday: null, // by default use system local today
    templateItems: DEFAULT_TIMETABLE_TEMPLATE,
    timetableByDate,
    fixedCommitmentsByDate,
    joyTaskByDate,
    backlogSessions: [],
  };
}

/**
 * Convert timetable items for a given date into the DayPlan required by backlogEngine
 */
export function buildDayPlan(
  date: DateKey,
  items: TimetableItem[] = [],
  fixedCommitmentMinutes: number = 0,
): DayPlan {
  const studyTasks: StudyTask[] = items
    .filter((item) => !item.isBreak)
    .map((item) => ({
      id: item.id,
      title: item.title,
      subject: item.subject,
      durationMinutes: item.durationMinutes,
      completed: Boolean(item.completed),
    }));

  return {
    date,
    fixedCommitmentMinutes,
    tasks: studyTasks,
  };
}

/**
 * Convert all timetableByDate into DayPlan[] for calculateBacklog()
 */
export function buildAllDayPlans(
  startDate: DateKey,
  targetDate: DateKey,
  timetableByDate: Record<DateKey, TimetableItem[]>,
  fixedCommitmentsByDate: Record<DateKey, number>,
  fallbackTemplate: TimetableItem[],
): DayPlan[] {
  const plans: DayPlan[] = [];
  let current = startDate;

  while (current <= targetDate) {
    const items = timetableByDate[current] || createItemsFromTemplate(fallbackTemplate);
    const fixed = fixedCommitmentsByDate[current] ?? 0;
    plans.push(buildDayPlan(current, items, fixed));
    current = addDays(current, 1);
  }

  return plans;
}
