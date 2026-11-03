import { DateKey, daysBetween } from './backlogEngine';

export const APP_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns the current calendar date in Asia/Kolkata timezone (IST) as 'YYYY-MM-DD'.
 * Uses JavaScript Intl.DateTimeFormat on the browser/device clock.
 * Does NOT use UTC date conversion, avoiding day-shift discrepancies.
 */
export function getIndianCalendarTodayKey(now: Date = new Date()): DateKey {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to resolve calendar parts for Asia/Kolkata timezone');
  }

  return `${year}-${month}-${day}`;
}

export interface StudyPeriodInfo {
  phase: 'before_start' | 'in_progress' | 'target_day' | 'completed';
  currentStudyDay: number; // 0 if not started, 1..N during study period, totalStudyDays if finished
  totalStudyDays: number;
  daysUntilStart: number;
  daysRemainingIncludingToday: number;
  daysElapsed: number;
  statusText: string;
}

/**
 * Derives current study day and remaining days dynamically from the configured
 * start/target dates and the actual current date (Asia/Kolkata).
 */
export function getStudyPeriodInfo(
  currentDate: DateKey,
  startDate: DateKey,
  targetDate: DateKey,
): StudyPeriodInfo {
  const totalStudyDays = Math.max(1, daysBetween(startDate, targetDate) + 1);

  if (currentDate < startDate) {
    const daysUntilStart = daysBetween(currentDate, startDate);
    const daysRemaining = daysBetween(currentDate, targetDate) + 1;
    return {
      phase: 'before_start',
      currentStudyDay: 0,
      totalStudyDays,
      daysUntilStart,
      daysRemainingIncludingToday: daysRemaining,
      daysElapsed: 0,
      statusText: `Study begins in ${daysUntilStart} day${daysUntilStart > 1 ? 's' : ''} (${startDate})`,
    };
  }

  if (currentDate > targetDate) {
    const daysSinceExam = daysBetween(targetDate, currentDate);
    return {
      phase: 'completed',
      currentStudyDay: totalStudyDays,
      totalStudyDays,
      daysUntilStart: 0,
      daysRemainingIncludingToday: 0,
      daysElapsed: totalStudyDays,
      statusText: `Study period finished (${daysSinceExam} day${daysSinceExam > 1 ? 's' : ''} past examination)`,
    };
  }

  const currentStudyDay = daysBetween(startDate, currentDate) + 1;
  const daysRemaining = daysBetween(currentDate, targetDate) + 1;
  const isTargetDay = currentDate === targetDate;

  return {
    phase: isTargetDay ? 'target_day' : 'in_progress',
    currentStudyDay,
    totalStudyDays,
    daysUntilStart: 0,
    daysRemainingIncludingToday: daysRemaining,
    daysElapsed: currentStudyDay - 1,
    statusText: isTargetDay
      ? `Examination Day! (Day ${currentStudyDay} of ${totalStudyDays})`
      : `Day ${currentStudyDay} of ${totalStudyDays}`,
  };
}
