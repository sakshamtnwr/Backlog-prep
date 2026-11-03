import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  Edit2,
  Plus,
  Sliders,
  ChevronRight,
  Info,
} from 'lucide-react';
import { TimetableItem } from '../types';
import {
  DateKey,
  DayPlan,
  BacklogSession,
  formatMinutes,
  addDays,
  daysBetween,
  getFreeTimeMinutes,
  setBacklogSessionCompletion,
  BacklogAllocation,
} from '../lib/backlogEngine';

interface CalendarPlannerViewProps {
  startDate: DateKey;
  targetDate: DateKey;
  todayDate: DateKey;
  selectedDate: DateKey;
  onSelectDate: (date: DateKey) => void;
  timetableByDate: Record<DateKey, TimetableItem[]>;
  fixedCommitmentsByDate: Record<DateKey, number>;
  backlogSessions: BacklogSession[];
  allocations: BacklogAllocation[];
  onToggleTaskCompletion: (date: DateKey, taskId: string, completed: boolean) => void;
  onUpdateTaskDuration: (date: DateKey, taskId: string, newDurationMinutes: number) => void;
  onToggleHistoricalBacklogSession: (allocation: BacklogAllocation, completed: boolean) => void;
  onOpenTimetableEditorForDate: (date: DateKey) => void;
  onUpdateFixedCommitments: (date: DateKey, minutes: number) => void;
}

export const CalendarPlannerView: React.FC<CalendarPlannerViewProps> = ({
  startDate,
  targetDate,
  todayDate,
  selectedDate,
  onSelectDate,
  timetableByDate,
  fixedCommitmentsByDate,
  backlogSessions,
  allocations,
  onToggleTaskCompletion,
  onUpdateTaskDuration,
  onToggleHistoricalBacklogSession,
  onOpenTimetableEditorForDate,
  onUpdateFixedCommitments,
}) => {
  const [editingDurationTaskId, setEditingDurationTaskId] = useState<string | null>(null);
  const [durationInput, setDurationInput] = useState<string>('');

  // Generate list of all dates from startDate to targetDate
  const allDates: DateKey[] = [];
  let d = startDate;
  while (d <= targetDate) {
    allDates.push(d);
    d = addDays(d, 1);
  }

  const selectedItems = timetableByDate[selectedDate] || [];
  const selectedFixed = fixedCommitmentsByDate[selectedDate] ?? 0;
  const isPast = selectedDate < todayDate;
  const isToday = selectedDate === todayDate;
  const isFuture = selectedDate > todayDate;

  // Study tasks on selected date
  const selectedStudyTasks = selectedItems.filter((i) => !i.isBreak);
  const selectedCompletedCount = selectedStudyTasks.filter((t) => t.completed).length;

  // Historical recovery sessions that landed on this selected date
  const allocationsOnSelectedDate = allocations.filter((a) => a.date === selectedDate);

  const handleStartEditDuration = (taskId: string, currentDur: number) => {
    setEditingDurationTaskId(taskId);
    setDurationInput(String(currentDur));
  };

  const handleSaveDuration = (taskId: string) => {
    const val = parseInt(durationInput, 10);
    if (!isNaN(val) && val >= 0) {
      onUpdateTaskDuration(selectedDate, taskId, val);
      setEditingDurationTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header Notice */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                Exam Preparation Calendar ({allDates.length} Days)
              </span>
              <span className="text-xs text-slate-500">
                {startDate} – {targetDate}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Historical Review & Date Navigator
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Click any date below to inspect its tasks, mark past completions, edit durations, or adjust recovery sessions.
              Calculations recompute automatically.
            </p>
          </div>
        </div>

        {/* 28-day Date Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 mt-5">
          {allDates.map((dateKey) => {
            const items = timetableByDate[dateKey] || [];
            const study = items.filter((i) => !i.isBreak);
            const completed = study.filter((i) => i.completed).length;
            const isSelected = dateKey === selectedDate;
            const isDatePast = dateKey < todayDate;
            const isDateToday = dateKey === todayDate;

            // Day number
            const dayNum = daysBetween(startDate, dateKey) + 1;
            const dateObj = new Date(dateKey + 'T00:00:00');
            const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onSelectDate(dateKey)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-xs'
                    : isDateToday
                    ? 'border-amber-400 bg-amber-50/40 hover:bg-amber-50'
                    : isDatePast
                    ? 'border-slate-200 bg-white hover:bg-slate-50'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-bold text-slate-900">
                    Day {dayNum}
                  </span>
                  <span className={`font-semibold ${isDateToday ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>
                    {dayOfWeek}
                  </span>
                </div>

                <div className="text-xs font-mono font-medium text-slate-700">
                  {dateKey.slice(5)}
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className={`${completed === study.length && study.length > 0 ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                    {completed}/{study.length} done
                  </span>
                  {isDateToday && (
                    <span className="px-1 py-0.2 rounded bg-amber-200 text-amber-900 font-bold">
                      TODAY
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Detailed Inspection & Editor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-white px-2.5 py-0.5 rounded border border-slate-300">
                {selectedDate} ({daysBetween(startDate, selectedDate) + 1} of 28)
              </span>
              {isPast && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                  Historical Date
                </span>
              )}
              {isToday && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                  Today
                </span>
              )}
              {isFuture && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  Future Planned Date
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">
              Plan & Completions on {selectedDate}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenTimetableEditorForDate(selectedDate)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Edit Day Timetable</span>
            </button>
          </div>
        </div>

        {/* Historical study tasks */}
        <div className="p-4">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-3">
            <span className="font-bold text-slate-800 uppercase tracking-wider">
              Study Tasks ({selectedCompletedCount}/{selectedStudyTasks.length} Completed)
            </span>
            <span className="text-slate-500">
              Click checkbox to toggle completion. Changing past tasks recalculates backlog.
            </span>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden mb-6">
            {selectedStudyTasks.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No study tasks scheduled for this day.
              </div>
            ) : (
              selectedStudyTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3.5 flex items-center justify-between gap-3 ${
                    task.completed ? 'bg-emerald-50/30' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => onToggleTaskCompletion(selectedDate, task.id, !task.completed)}
                      className="text-slate-400 hover:text-emerald-600 cursor-pointer transition-colors"
                      title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {task.subject}
                        </span>
                        <span className="text-xs text-slate-400">
                          {task.startTime} – {task.endTime}
                        </span>
                      </div>
                      <p className={`text-sm font-semibold truncate mt-0.5 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        {task.title}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {editingDurationTaskId === task.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="720"
                          value={durationInput}
                          onChange={(e) => setDurationInput(e.target.value)}
                          className="w-20 px-2 py-1 text-xs border border-blue-400 rounded bg-white text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveDuration(task.id)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDurationTaskId(null)}
                          className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {formatMinutes(task.durationMinutes)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartEditDuration(task.id, task.durationMinutes)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                          title="Edit duration"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Allocated Backlog Sessions landing on this date */}
          {allocationsOnSelectedDate.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                <span className="font-bold text-amber-900 uppercase tracking-wider">
                  Backlog Recovery Sessions on {selectedDate}
                </span>
                <span className="text-slate-500">
                  Recovery sessions scheduled to be completed on this day
                </span>
              </div>

              <div className="divide-y divide-slate-100 border border-amber-200 rounded-xl overflow-hidden bg-amber-50/20">
                {allocationsOnSelectedDate.map((alloc) => (
                  <div
                    key={alloc.id}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onToggleHistoricalBacklogSession(alloc, !alloc.completed)}
                        className="text-slate-400 hover:text-emerald-600 cursor-pointer transition-colors"
                        title={alloc.completed ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {alloc.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          {alloc.taskTitle} ({alloc.subject})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Missed on {alloc.sourceDate} • Allocated: {formatMinutes(alloc.minutes)}
                        </div>
                      </div>
                    </div>

                    <span className={`text-xs font-bold ${alloc.completed ? 'text-emerald-600' : 'text-amber-700'}`}>
                      {alloc.completed ? 'Recovered' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
