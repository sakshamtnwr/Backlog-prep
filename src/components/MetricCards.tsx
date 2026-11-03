import React from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Flame,
  ShieldAlert,
  BatteryCharging,
  TrendingDown,
  RotateCcw,
} from 'lucide-react';
import { formatMinutes, DateKey, daysBetween } from '../lib/backlogEngine';
import { BacklogEngineResult } from '../lib/backlogEngine';

interface MetricCardsProps {
  engineResult: BacklogEngineResult;
  todayDate: DateKey;
  startDate: DateKey;
  targetDate: DateKey;
  todayPlannedStudyMinutes: number;
  todayCompletedStudyMinutes: number;
  todayScheduledBacklogMinutes: number;
  todayFreeTimeMinutes: number;
  todayRemainingFreeTimeMinutes: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  engineResult,
  todayDate,
  startDate,
  targetDate,
  todayPlannedStudyMinutes,
  todayCompletedStudyMinutes,
  todayScheduledBacklogMinutes,
  todayFreeTimeMinutes,
  todayRemainingFreeTimeMinutes,
}) => {
  const totalDays = daysBetween(startDate, targetDate) + 1; // 28
  const currentDayNum =
    todayDate < startDate
      ? 0
      : todayDate > targetDate
      ? totalDays
      : daysBetween(startDate, todayDate) + 1;

  const daysRemaining =
    todayDate <= targetDate
      ? daysBetween(todayDate, targetDate) + 1
      : 0;

  // Workload = original study + scheduled backlog
  const totalTodayWorkloadMinutes = todayPlannedStudyMinutes + todayScheduledBacklogMinutes;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {/* 1. Current Day / Total Study Period */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Study Timeline
          </span>
          <Calendar className="w-4 h-4 text-slate-400" />
        </div>
        <div className="text-xl font-bold text-slate-900">
          {currentDayNum > 0 && currentDayNum <= totalDays
            ? `Day ${currentDayNum} / ${totalDays}`
            : todayDate < startDate
            ? `Prep (${daysBetween(todayDate, startDate)}d)`
            : `Finished`}
        </div>
        <div className="text-[11px] text-slate-500 mt-1 truncate">
          {startDate} → {targetDate}
        </div>
      </div>

      {/* 2. Days Remaining */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Days Remaining
          </span>
          <Clock className="w-4 h-4 text-blue-500" />
        </div>
        <div className="text-xl font-bold text-blue-600">
          {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
        </div>
        <div className="text-[11px] text-slate-500 mt-1 truncate">
          Target: {targetDate} (Cutoff: {engineResult.recoveryCutoffDate})
        </div>
      </div>

      {/* 3. Today's Original Study Target */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Today Planned
          </span>
          <Clock className="w-4 h-4 text-slate-400" />
        </div>
        <div className="text-xl font-bold text-slate-900">
          {formatMinutes(todayPlannedStudyMinutes)}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          Original syllabus target
        </div>
      </div>

      {/* 4. Today's Completed Study */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Today Completed
          </span>
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-xl font-bold text-emerald-600">
          {formatMinutes(todayCompletedStudyMinutes)}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          {todayPlannedStudyMinutes > 0
            ? `${Math.round((todayCompletedStudyMinutes / todayPlannedStudyMinutes) * 100)}% of today's target`
            : 'No tasks scheduled'}
        </div>
      </div>

      {/* 5. Today's Scheduled Backlog */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Today Backlog
          </span>
          <RotateCcw className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-xl font-bold text-amber-600">
          {formatMinutes(todayScheduledBacklogMinutes)}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          Allocated recovery blocks
        </div>
      </div>

      {/* 6. Today's Total Study Workload */}
      <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs">
        <div className="flex items-center justify-between text-blue-700 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Total Workload
          </span>
          <Flame className="w-4 h-4 text-blue-600" />
        </div>
        <div className="text-xl font-bold text-blue-900">
          {formatMinutes(totalTodayWorkloadMinutes)}
        </div>
        <div className="text-[11px] text-blue-700/80 mt-1">
          Planned + Scheduled Backlog
        </div>
      </div>

      {/* 7. Available Free Time & Remaining Free Time */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Free Time
          </span>
          <BatteryCharging className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-xl font-bold text-slate-800">
          {formatMinutes(todayRemainingFreeTimeMinutes)}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          Base: {formatMinutes(todayFreeTimeMinutes)} (after 7h sleep)
        </div>
      </div>

      {/* 8. Total Remaining Backlog (All Batches) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Pending Backlog
          </span>
          <AlertCircle className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-xl font-bold text-amber-700">
          {formatMinutes(engineResult.totals.pendingMinutes)}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          Across all active batches
        </div>
      </div>

      {/* 9. Projected Discarded Hours */}
      <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs">
        <div className="flex items-center justify-between text-amber-800 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Projected Discard
          </span>
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        <div className="text-xl font-bold text-amber-800">
          {formatMinutes(engineResult.totals.projectedDiscardMinutes)}
        </div>
        <div className="text-[11px] text-amber-700/80 mt-1" title="May change if plans are freed">
          Forecast (unfitted slots)
        </div>
      </div>

      {/* 10. Permanently Discarded Hours */}
      <div className="bg-white p-3.5 rounded-xl border border-red-200 bg-red-50/20 shadow-2xs">
        <div className="flex items-center justify-between text-red-700 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Permanent Discard
          </span>
          <TrendingDown className="w-4 h-4 text-red-600" />
        </div>
        <div className="text-xl font-bold text-red-700">
          {formatMinutes(engineResult.totals.discardedMinutes)}
        </div>
        <div className="text-[11px] text-red-600/80 mt-1">
          Closed recovery windows
        </div>
      </div>

      {/* 11. Total Recovered Hours */}
      <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs col-span-2 sm:col-span-1 lg:col-span-2">
        <div className="flex items-center justify-between text-emerald-800 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Total Recovered
          </span>
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="text-xl font-bold text-emerald-700">
          {formatMinutes(engineResult.totals.recoveredMinutes)}
        </div>
        <div className="text-[11px] text-emerald-700/80 mt-1">
          Completed backlog sessions across period
        </div>
      </div>
    </div>
  );
};
