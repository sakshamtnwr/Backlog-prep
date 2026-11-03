import {
  DateKey,
  DayPlan,
  StudyTask,
  BacklogSession,
  BacklogAllocation,
  BacklogBatchSummary,
  DayCapacitySummary,
  BacklogEngineResult,
} from './lib/backlogEngine';

export interface TimetableItem {
  id: string; // Stable ID
  startTime: string; // e.g. "06:00"
  endTime: string; // e.g. "08:30"
  title: string;
  subject: string; // "DSA", "Question Paper Solving", "Revision", "FastAPI", or "Break"
  durationMinutes: number;
  isBreak: boolean;
  completed?: boolean; // For date-specific study tasks
}

export interface AppSettings {
  startDate: DateKey;
  targetDate: DateKey;
  cutoffDate: DateKey;
  protectedSleepMinutes: number; // 420
  targetDailyStudyMinutes: number; // 660 (11h)
  dismissedSleepWarning: boolean;
}

export interface AppStateData {
  schemaVersion: number;
  exportedAt?: string;
  settings: AppSettings;
  simulatedToday: DateKey | null; // null means use system local today
  templateItems: TimetableItem[];
  timetableByDate: Record<DateKey, TimetableItem[]>;
  fixedCommitmentsByDate: Record<DateKey, number>;
  joyTaskByDate: Record<DateKey, boolean>;
  backlogSessions: BacklogSession[];
}

export type ActiveTab = 'today' | 'backlog' | 'calendar' | 'template' | 'verification';
