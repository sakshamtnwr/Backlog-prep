import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Coffee,
  BookOpen,
  Heart,
  RotateCcw,
  Clock,
  Sparkles,
  Sliders,
  AlertTriangle,
  Plus,
  Shield,
} from 'lucide-react';
import { TimetableItem } from '../types';
import {
  DateKey,
  BacklogAllocation,
  formatMinutes,
  DAY_MINUTES,
  SLEEP_MINUTES,
} from '../lib/backlogEngine';

interface TodayWorkloadViewProps {
  date: DateKey;
  timetableItems: TimetableItem[];
  fixedCommitmentMinutes: number;
  joyTaskCompleted: boolean;
  todaysBacklogAllocations: BacklogAllocation[];
  onToggleTaskCompletion: (taskId: string, completed: boolean) => void;
  onToggleBacklogSession: (allocation: BacklogAllocation, completed: boolean) => void;
  onToggleJoyTask: (completed: boolean) => void;
  onOpenTimetableEditor: () => void;
  onUpdateFixedCommitments: (minutes: number) => void;
}

export const TodayWorkloadView: React.FC<TodayWorkloadViewProps> = ({
  date,
  timetableItems,
  fixedCommitmentMinutes,
  joyTaskCompleted,
  todaysBacklogAllocations,
  onToggleTaskCompletion,
  onToggleBacklogSession,
  onToggleJoyTask,
  onOpenTimetableEditor,
  onUpdateFixedCommitments,
}) => {
  const [editingCommitments, setEditingCommitments] = useState(false);
  const [commitmentsInput, setCommitmentsInput] = useState(String(fixedCommitmentMinutes));

  // Calculate subject-wise progress from individual tasks
  const studyTasks = timetableItems.filter((item) => !item.isBreak);
  const breakTasks = timetableItems.filter((item) => item.isBreak);

  // Group study tasks by subject
  const subjectMap = new Map<
    string,
    { totalMinutes: number; completedMinutes: number; totalCount: number; completedCount: number }
  >();

  for (const task of studyTasks) {
    const existing = subjectMap.get(task.subject) || {
      totalMinutes: 0,
      completedMinutes: 0,
      totalCount: 0,
      completedCount: 0,
    };
    existing.totalMinutes += task.durationMinutes;
    existing.totalCount += 1;
    if (task.completed) {
      existing.completedMinutes += task.durationMinutes;
      existing.completedCount += 1;
    }
    subjectMap.set(task.subject, existing);
  }

  const subjectList = Array.from(subjectMap.entries()).map(([subject, stats]) => ({
    subject,
    ...stats,
    percentage: stats.totalMinutes > 0 ? Math.round((stats.completedMinutes / stats.totalMinutes) * 100) : 0,
  }));

  const totalStudyMinutes = studyTasks.reduce((acc, t) => acc + t.durationMinutes, 0);
  const totalCompletedMinutes = studyTasks
    .filter((t) => t.completed)
    .reduce((acc, t) => acc + t.durationMinutes, 0);

  const totalScheduledBacklogMinutes = todaysBacklogAllocations.reduce((acc, a) => acc + a.minutes, 0);
  const totalRecoveredTodayMinutes = todaysBacklogAllocations
    .filter((a) => a.completed)
    .reduce((acc, a) => acc + a.minutes, 0);

  // Free-time math
  const usedBaseMinutes = SLEEP_MINUTES + fixedCommitmentMinutes + totalStudyMinutes;
  const baseFreeTimeMinutes = Math.max(0, DAY_MINUTES - usedBaseMinutes);
  const remainingFreeTimeMinutes = Math.max(0, baseFreeTimeMinutes - totalScheduledBacklogMinutes);
  const isOverbooked = usedBaseMinutes > DAY_MINUTES;

  const handleSaveCommitments = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(commitmentsInput, 10);
    if (!isNaN(val) && val >= 0) {
      onUpdateFixedCommitments(val);
      setEditingCommitments(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Date & Capacity Budget */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                Daily Focus: {date}
              </span>
              {isOverbooked && (
                <span className="text-xs font-bold uppercase tracking-wider text-red-700 bg-red-100 px-2.5 py-1 rounded-md border border-red-300 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Overbooked by {formatMinutes(usedBaseMinutes - DAY_MINUTES)}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Today's Schedule & Workload
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenTimetableEditor}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Customize Timetable</span>
            </button>
          </div>
        </div>

        {/* 24-Hour Time Capacity Budget Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-semibold text-slate-800">24-Hour Capacity Breakdown (1,440 min)</span>
            <span className="text-slate-500">
              Remaining Free Time: <strong className="text-slate-900">{formatMinutes(remainingFreeTimeMinutes)}</strong>
            </span>
          </div>

          {/* Progress Bar representation */}
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200">
            {/* Sleep: 420m (29.17%) */}
            <div
              className="bg-indigo-500 h-full transition-all"
              style={{ width: `${(SLEEP_MINUTES / DAY_MINUTES) * 100}%` }}
              title={`Protected Sleep: ${formatMinutes(SLEEP_MINUTES)} (fixed)`}
            />
            {/* Fixed commitments */}
            {fixedCommitmentMinutes > 0 && (
              <div
                className="bg-amber-400 h-full transition-all"
                style={{ width: `${(fixedCommitmentMinutes / DAY_MINUTES) * 100}%` }}
                title={`Fixed Commitments: ${formatMinutes(fixedCommitmentMinutes)}`}
              />
            )}
            {/* Planned Study */}
            <div
              className="bg-blue-600 h-full transition-all"
              style={{ width: `${(Math.min(totalStudyMinutes, DAY_MINUTES - SLEEP_MINUTES - fixedCommitmentMinutes) / DAY_MINUTES) * 100}%` }}
              title={`Planned Study: ${formatMinutes(totalStudyMinutes)}`}
            />
            {/* Backlog */}
            {totalScheduledBacklogMinutes > 0 && (
              <div
                className="bg-amber-500 h-full transition-all"
                style={{ width: `${(Math.min(totalScheduledBacklogMinutes, baseFreeTimeMinutes) / DAY_MINUTES) * 100}%` }}
                title={`Scheduled Backlog: ${formatMinutes(totalScheduledBacklogMinutes)}`}
              />
            )}
            {/* Remaining free */}
            {remainingFreeTimeMinutes > 0 && (
              <div
                className="bg-emerald-400/30 h-full transition-all flex-1"
                title={`Free Time: ${formatMinutes(remainingFreeTimeMinutes)}`}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              Protected Sleep: {formatMinutes(SLEEP_MINUTES)} (Fixed)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              Planned Study: {formatMinutes(totalStudyMinutes)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Backlog: {formatMinutes(totalScheduledBacklogMinutes)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              Fixed Commitments: {formatMinutes(fixedCommitmentMinutes)}
              {!editingCommitments ? (
                <button
                  type="button"
                  onClick={() => {
                    setCommitmentsInput(String(fixedCommitmentMinutes));
                    setEditingCommitments(true);
                  }}
                  className="text-blue-600 hover:underline cursor-pointer ml-1"
                >
                  (Edit)
                </button>
              ) : null}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Available Free Time: {formatMinutes(remainingFreeTimeMinutes)}
            </span>
          </div>

          {editingCommitments && (
            <form onSubmit={handleSaveCommitments} className="flex items-center gap-2 pt-2">
              <span className="text-xs text-slate-700">Fixed commitments on {date} (minutes):</span>
              <input
                type="number"
                min="0"
                max="720"
                value={commitmentsInput}
                onChange={(e) => setCommitmentsInput(e.target.value)}
                className="w-24 px-2 py-1 text-xs border border-slate-300 rounded bg-white"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingCommitments(false)}
                className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded text-xs cursor-pointer"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Anytime Joy Task Card */}
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-4 rounded-xl border border-pink-200/80 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onToggleJoyTask(!joyTaskCompleted)}
              className="text-pink-600 hover:text-pink-700 cursor-pointer transition-transform active:scale-95"
              title={joyTaskCompleted ? 'Mark incomplete' : 'Mark complete'}
            >
              {joyTaskCompleted ? (
                <CheckCircle2 className="w-6 h-6 fill-pink-500 text-white" />
              ) : (
                <Circle className="w-6 h-6 text-pink-400 stroke-[2]" />
              )}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Heart className={`w-4 h-4 ${joyTaskCompleted ? 'fill-pink-500 text-pink-500' : 'text-pink-400'}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-pink-800">
                  Anytime Daily Task
                </span>
              </div>
              <p className={`text-sm font-semibold mt-0.5 ${joyTaskCompleted ? 'text-pink-900 line-through opacity-75' : 'text-pink-950'}`}>
                "Do one thing that brings me joy."
              </p>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-[11px] font-medium text-pink-700 bg-pink-100/70 px-2.5 py-1 rounded-full border border-pink-200">
              Wellness Only (0m study/backlog impact)
            </span>
          </div>
        </div>
      </div>

      {/* Subject-Wise Progress Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Subject-Wise Targets & Progress</span>
          </h3>
          <span className="text-xs text-slate-500">
            {formatMinutes(totalCompletedMinutes)} of {formatMinutes(totalStudyMinutes)} completed ({studyTasks.filter(t => t.completed).length}/{studyTasks.length} tasks)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {subjectList.map((item) => (
            <div key={item.subject} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-800 truncate" title={item.subject}>
                  {item.subject}
                </span>
                <span className="font-semibold text-slate-600">
                  {item.percentage}%
                </span>
              </div>

              <div className="text-base font-bold text-slate-900 mb-1.5">
                {formatMinutes(item.completedMinutes)}
                <span className="text-xs font-normal text-slate-500 ml-1">
                  / {formatMinutes(item.totalMinutes)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    item.percentage === 100
                      ? 'bg-emerald-500'
                      : item.percentage > 0
                      ? 'bg-blue-600'
                      : 'bg-slate-200'
                  }`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>

              <div className="text-[11px] text-slate-400 mt-1.5 flex justify-between">
                <span>{item.completedCount} of {item.totalCount} blocks done</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's Scheduled Backlog Recovery Section */}
      <div className="bg-white rounded-2xl border border-amber-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500 text-white shadow-2xs">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Today's Backlog Recovery Workload
              </h3>
              <p className="text-xs text-amber-800">
                Missed tasks from previous days allocated to today's free-time window
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold text-amber-900 bg-amber-200/80 px-2.5 py-1 rounded-full border border-amber-300">
              {formatMinutes(totalScheduledBacklogMinutes)} scheduled
            </span>
          </div>
        </div>

        <div className="p-4">
          {todaysBacklogAllocations.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 border border-emerald-200">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                No backlog recovery scheduled for today!
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-0.5">
                Either all prior tasks were completed on time, or no active recovery allocations land on this date.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {todaysBacklogAllocations.map((alloc) => (
                <div
                  key={alloc.id}
                  className={`py-3 flex items-center justify-between gap-3 transition-colors ${
                    alloc.completed ? 'bg-emerald-50/40 px-2 rounded-lg' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleBacklogSession(alloc, !alloc.completed)}
                      className="mt-0.5 text-slate-400 hover:text-emerald-600 cursor-pointer transition-colors"
                      title={alloc.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {alloc.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          {alloc.subject}
                        </span>
                        <span className="text-xs text-slate-500">
                          Missed on: <strong>{alloc.sourceDate}</strong>
                        </span>
                      </div>
                      <p className={`text-sm font-medium mt-0.5 ${alloc.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        {alloc.taskTitle}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-slate-900">
                      +{formatMinutes(alloc.minutes)}
                    </div>
                    <span className={`text-[11px] font-medium ${alloc.completed ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {alloc.completed ? 'Recovered' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Today's Full Timetable & Checklist */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Daily Timetable & Tasks ({date})
            </h3>
            <p className="text-xs text-slate-500">
              Check off completed study sessions. Break blocks are shown for pacing and do not trigger backlog.
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200">
            {timetableItems.length} total blocks
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {timetableItems.map((item) => {
            if (item.isBreak) {
              return (
                <div
                  key={item.id}
                  className="px-4 py-2.5 bg-slate-50/60 flex items-center justify-between text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 flex justify-center text-slate-400">
                      <Coffee className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-700">
                        {item.title}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-2">
                        {item.startTime} – {item.endTime}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs text-slate-400 font-medium">
                    {formatMinutes(item.durationMinutes)} (Break)
                  </span>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className={`px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                  item.completed ? 'bg-emerald-50/30' : 'hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => onToggleTaskCompletion(item.id, !item.completed)}
                    className="text-slate-400 hover:text-emerald-600 cursor-pointer transition-colors"
                    title={item.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {item.subject}
                      </span>
                      <span className="text-xs text-slate-400">
                        {item.startTime} – {item.endTime}
                      </span>
                    </div>
                    <p
                      className={`text-sm font-semibold truncate mt-0.5 ${
                        item.completed ? 'text-slate-500 line-through' : 'text-slate-900'
                      }`}
                    >
                      {item.title}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-slate-900">
                    {formatMinutes(item.durationMinutes)}
                  </div>
                  <span
                    className={`text-[11px] font-semibold ${
                      item.completed ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {item.completed ? 'Completed' : 'Study Task'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
