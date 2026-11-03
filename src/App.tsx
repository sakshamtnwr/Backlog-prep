import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ActiveTab,
  AppStateData,
  TimetableItem,
  AppSettings,
} from './types';
import {
  DateKey,
  calculateBacklog,
  setBacklogSessionCompletion,
  addDays,
  BacklogAllocation,
  BacklogEngineResult,
  getBacklogRecoveryCutoff,
} from './lib/backlogEngine';
import {
  loadAppState,
  saveAppState,
  resetToDefaults,
} from './lib/storage';
import {
  buildAllDayPlans,
  createItemsFromTemplate,
} from './lib/initialData';
import {
  getIndianCalendarTodayKey,
  APP_TIMEZONE,
  getStudyPeriodInfo,
} from './lib/dateUtils';
import { Header } from './components/Header';
import { SleepWarningBanner } from './components/SleepWarningBanner';
import { MetricCards } from './components/MetricCards';
import { TodayWorkloadView } from './components/TodayWorkloadView';
import { BacklogOverviewView } from './components/BacklogOverviewView';
import { CalendarPlannerView } from './components/CalendarPlannerView';
import { TimetableEditorModal } from './components/TimetableEditorModal';
import { VerificationPanel } from './components/VerificationPanel';
import { ImportExportModal } from './components/ImportExportModal';
import { SettingsModal } from './components/SettingsModal';

export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppStateData>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false);
  const [timetableModalTargetDate, setTimetableModalTargetDate] = useState<DateKey | null>(null);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // 1. Dynamic current calendar date in Asia/Kolkata (IST) determined via JavaScript
  const [currentKolkataDate, setCurrentKolkataDate] = useState<DateKey>(() => getIndianCalendarTodayKey());

  // Function to refresh date directly from the browser/device clock
  const refreshCurrentDate = useCallback(() => {
    const fresh = getIndianCalendarTodayKey();
    setCurrentKolkataDate((prev) => (prev !== fresh ? fresh : prev));
  }, []);

  // Set up listeners: loads, window focus, visibility change, and across-midnight interval
  useEffect(() => {
    refreshCurrentDate();

    const handleFocus = () => refreshCurrentDate();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshCurrentDate();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Check periodically (every 10 seconds) to ensure midnight transitions update immediately
    const timerId = setInterval(refreshCurrentDate, 10000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(timerId);
    };
  }, [refreshCurrentDate]);

  // Date being viewed/managed in Today's Workload: defaults to live currentKolkataDate
  const [viewedDate, setViewedDate] = useState<DateKey>(() => getIndianCalendarTodayKey());

  // When live current date changes (e.g. across midnight), if user was viewing today, keep them on today
  useEffect(() => {
    setViewedDate((prev) => {
      // If the user hasn't explicitly navigated to a historical/future date, follow currentKolkataDate
      return prev < currentKolkataDate && prev === addDays(currentKolkataDate, -1)
        ? currentKolkataDate
        : prev;
    });
  }, [currentKolkataDate]);

  // Selected date for calendar view: defaults to viewedDate
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<DateKey>(viewedDate);

  // Persist state to localStorage on changes
  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  // Convert timetableByDate into DayPlan[] required by calculateBacklog
  const allDayPlans = useMemo(() => {
    return buildAllDayPlans(
      appState.settings.startDate,
      appState.settings.targetDate,
      appState.timetableByDate,
      appState.fixedCommitmentsByDate,
      appState.templateItems,
    );
  }, [
    appState.settings.startDate,
    appState.settings.targetDate,
    appState.timetableByDate,
    appState.fixedCommitmentsByDate,
    appState.templateItems,
  ]);

  // Run the authoritative backlog calculation engine with dynamic currentKolkataDate
  const engineResult: BacklogEngineResult = useMemo(() => {
    return calculateBacklog({
      startDate: appState.settings.startDate,
      targetDate: appState.settings.targetDate,
      today: currentKolkataDate,
      plans: allDayPlans,
      backlogSessions: appState.backlogSessions,
    });
  }, [
    appState.settings.startDate,
    appState.settings.targetDate,
    currentKolkataDate,
    allDayPlans,
    appState.backlogSessions,
  ]);

  // Items for the viewed date
  const viewedTimetableItems = useMemo(() => {
    return (
      appState.timetableByDate[viewedDate] ||
      createItemsFromTemplate(appState.templateItems)
    );
  }, [appState.timetableByDate, viewedDate, appState.templateItems]);

  // Recovery allocations for the viewed date
  const viewedBacklogAllocations = useMemo(() => {
    return engineResult.allocations.filter((a) => a.date === viewedDate);
  }, [engineResult.allocations, viewedDate]);

  // Metric statistics for today
  const todayPlannedStudyMinutes = useMemo(() => {
    const items = appState.timetableByDate[currentKolkataDate] || createItemsFromTemplate(appState.templateItems);
    return items
      .filter((i) => !i.isBreak)
      .reduce((sum, i) => sum + i.durationMinutes, 0);
  }, [appState.timetableByDate, currentKolkataDate, appState.templateItems]);

  const todayCompletedStudyMinutes = useMemo(() => {
    const items = appState.timetableByDate[currentKolkataDate] || createItemsFromTemplate(appState.templateItems);
    return items
      .filter((i) => !i.isBreak && i.completed)
      .reduce((sum, i) => sum + i.durationMinutes, 0);
  }, [appState.timetableByDate, currentKolkataDate, appState.templateItems]);

  const todayCapacitySummary = useMemo(() => {
    return engineResult.dayCapacity.find((c) => c.date === currentKolkataDate);
  }, [engineResult.dayCapacity, currentKolkataDate]);

  const todayScheduledBacklogMinutes = todayCapacitySummary?.backlogMinutes ?? 0;
  const todayFreeTimeMinutes = todayCapacitySummary?.freeTimeMinutes ?? 0;
  const todayRemainingFreeTimeMinutes = todayCapacitySummary?.remainingFreeTimeMinutes ?? 0;

  // Toggle study task completion on any date
  const handleToggleTaskCompletion = (date: DateKey, taskId: string, completed: boolean) => {
    setAppState((prev) => {
      const currentItems = prev.timetableByDate[date] || createItemsFromTemplate(prev.templateItems);
      const nextItems = currentItems.map((item) => {
        if (item.id === taskId) {
          return { ...item, completed };
        }
        return item;
      });

      return {
        ...prev,
        timetableByDate: {
          ...prev.timetableByDate,
          [date]: nextItems,
        },
      };
    });
  };

  // Toggle backlog session completion checkbox
  const handleToggleBacklogSession = (allocation: BacklogAllocation, completed: boolean) => {
    setAppState((prev) => {
      const nextSessions = setBacklogSessionCompletion(
        prev.backlogSessions,
        allocation,
        completed,
      );
      return {
        ...prev,
        backlogSessions: nextSessions,
      };
    });
  };

  // Toggle anytime joy task
  const handleToggleJoyTask = (date: DateKey, completed: boolean) => {
    setAppState((prev) => ({
      ...prev,
      joyTaskByDate: {
        ...prev.joyTaskByDate,
        [date]: completed,
      },
    }));
  };

  // Update task duration on a specific date
  const handleUpdateTaskDuration = (date: DateKey, taskId: string, newDurationMinutes: number) => {
    setAppState((prev) => {
      const currentItems = prev.timetableByDate[date] || createItemsFromTemplate(prev.templateItems);
      const nextItems = currentItems.map((item) => {
        if (item.id === taskId) {
          return { ...item, durationMinutes: newDurationMinutes };
        }
        return item;
      });
      return {
        ...prev,
        timetableByDate: {
          ...prev.timetableByDate,
          [date]: nextItems,
        },
      };
    });
  };

  // Update fixed commitments on a specific date
  const handleUpdateFixedCommitments = (date: DateKey, minutes: number) => {
    setAppState((prev) => ({
      ...prev,
      fixedCommitmentsByDate: {
        ...prev.fixedCommitmentsByDate,
        [date]: minutes,
      },
    }));
  };

  // Save timetable items from editor modal
  const handleSaveTimetableItems = (
    items: TimetableItem[],
    scope: 'single' | 'future' | 'template',
  ) => {
    setAppState((prev) => {
      if (scope === 'template') {
        return {
          ...prev,
          templateItems: items,
        };
      }

      if (scope === 'single' && timetableModalTargetDate) {
        return {
          ...prev,
          timetableByDate: {
            ...prev.timetableByDate,
            [timetableModalTargetDate]: items,
          },
        };
      }

      if (scope === 'future' && timetableModalTargetDate) {
        const nextTimetable = { ...prev.timetableByDate };
        let curr = timetableModalTargetDate;
        while (curr <= prev.settings.targetDate) {
          const existingForDay = nextTimetable[curr] || [];
          const existingCompletions = new Map(existingForDay.map((x) => [x.id, x.completed]));

          nextTimetable[curr] = items.map((it) => ({
            ...it,
            completed: it.isBreak ? undefined : Boolean(existingCompletions.get(it.id)),
          }));
          curr = addDays(curr, 1);
        }
        return {
          ...prev,
          timetableByDate: nextTimetable,
        };
      }

      return prev;
    });
  };

  // Save updated settings (start date, target date)
  const handleSaveSettings = (newSettings: Partial<AppSettings>) => {
    setAppState((prev) => {
      const updatedSettings = { ...prev.settings, ...newSettings };
      const nextTimetable = { ...prev.timetableByDate };
      let curr = updatedSettings.startDate;
      while (curr <= updatedSettings.targetDate) {
        if (!nextTimetable[curr]) {
          nextTimetable[curr] = createItemsFromTemplate(prev.templateItems);
        }
        curr = addDays(curr, 1);
      }
      return {
        ...prev,
        settings: updatedSettings,
        timetableByDate: nextTimetable,
      };
    });
  };

  // Reset to initial prefilled state with confirmation
  const handleResetToDefaults = () => {
    if (window.confirm('Reset all schedules and progress to initial default plan?')) {
      const resetState = resetToDefaults();
      setAppState(resetState);
      setViewedDate(currentKolkataDate);
      setSelectedCalendarDate(currentKolkataDate);
    }
  };

  const isViewingDifferentDate = viewedDate !== currentKolkataDate;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 pb-16 font-sans">
      {/* Header with dynamic IST clock, date navigator and tabs */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        settings={appState.settings}
        todayDate={viewedDate}
        currentKolkataDate={currentKolkataDate}
        isViewingDifferentDate={isViewingDifferentDate}
        onDateChange={setViewedDate}
        onResetToCurrentDate={() => setViewedDate(currentKolkataDate)}
        onOpenImportExport={() => setIsImportExportModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onResetToDefaults={handleResetToDefaults}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Sleep Schedule Advisory Banner */}
        <SleepWarningBanner
          dismissed={appState.settings.dismissedSleepWarning}
          onDismiss={() => {
            setAppState((prev) => ({
              ...prev,
              settings: { ...prev.settings, dismissedSleepWarning: true },
            }));
          }}
          onOpenTemplateEditor={() => {
            setTimetableModalTargetDate(null);
            setIsTimetableModalOpen(true);
          }}
        />

        {/* Dashboard 10 Metric Cards */}
        <MetricCards
          engineResult={engineResult}
          todayDate={currentKolkataDate}
          startDate={appState.settings.startDate}
          targetDate={appState.settings.targetDate}
          todayPlannedStudyMinutes={todayPlannedStudyMinutes}
          todayCompletedStudyMinutes={todayCompletedStudyMinutes}
          todayScheduledBacklogMinutes={todayScheduledBacklogMinutes}
          todayFreeTimeMinutes={todayFreeTimeMinutes}
          todayRemainingFreeTimeMinutes={todayRemainingFreeTimeMinutes}
        />

        {/* Active Tab View */}
        {activeTab === 'today' && (
          <TodayWorkloadView
            date={viewedDate}
            timetableItems={viewedTimetableItems}
            fixedCommitmentMinutes={appState.fixedCommitmentsByDate[viewedDate] ?? 0}
            joyTaskCompleted={Boolean(appState.joyTaskByDate[viewedDate])}
            todaysBacklogAllocations={viewedBacklogAllocations}
            onToggleTaskCompletion={(taskId, completed) =>
              handleToggleTaskCompletion(viewedDate, taskId, completed)
            }
            onToggleBacklogSession={handleToggleBacklogSession}
            onToggleJoyTask={(completed) => handleToggleJoyTask(viewedDate, completed)}
            onOpenTimetableEditor={() => {
              setTimetableModalTargetDate(viewedDate);
              setIsTimetableModalOpen(true);
            }}
            onUpdateFixedCommitments={(mins) => handleUpdateFixedCommitments(viewedDate, mins)}
          />
        )}

        {activeTab === 'backlog' && (
          <BacklogOverviewView
            batches={engineResult.batches}
            allocations={engineResult.allocations}
            todayDate={currentKolkataDate}
            cutoffDate={engineResult.recoveryCutoffDate}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarPlannerView
            startDate={appState.settings.startDate}
            targetDate={appState.settings.targetDate}
            todayDate={currentKolkataDate}
            selectedDate={selectedCalendarDate}
            onSelectDate={setSelectedCalendarDate}
            timetableByDate={appState.timetableByDate}
            fixedCommitmentsByDate={appState.fixedCommitmentsByDate}
            backlogSessions={appState.backlogSessions}
            allocations={engineResult.allocations}
            onToggleTaskCompletion={handleToggleTaskCompletion}
            onUpdateTaskDuration={handleUpdateTaskDuration}
            onToggleHistoricalBacklogSession={handleToggleBacklogSession}
            onOpenTimetableEditorForDate={(date) => {
              setTimetableModalTargetDate(date);
              setIsTimetableModalOpen(true);
            }}
            onUpdateFixedCommitments={handleUpdateFixedCommitments}
          />
        )}

        {activeTab === 'template' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Recurring Daily Timetable Template
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  This master template defines the default 11-hour study schedule applied to days across your study period.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTimetableModalTargetDate(null);
                  setIsTimetableModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                Edit Master Template
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {appState.templateItems.map((item) => (
                <div
                  key={item.id}
                  className={`px-4 py-3 flex items-center justify-between ${
                    item.isBreak ? 'bg-slate-50/60 text-slate-500' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400">
                      {item.startTime} – {item.endTime}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {item.subject}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    {item.durationMinutes} min
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'verification' && <VerificationPanel />}
      </main>

      {/* Timetable Editor Modal */}
      <TimetableEditorModal
        isOpen={isTimetableModalOpen}
        onClose={() => {
          setIsTimetableModalOpen(false);
          setTimetableModalTargetDate(null);
        }}
        targetDateKey={timetableModalTargetDate}
        initialItems={
          timetableModalTargetDate
            ? appState.timetableByDate[timetableModalTargetDate] ||
              createItemsFromTemplate(appState.templateItems)
            : appState.templateItems
        }
        onSave={handleSaveTimetableItems}
      />

      {/* Settings Modal: Start Date & Target Date */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={appState.settings}
        currentKolkataDate={currentKolkataDate}
        onSave={handleSaveSettings}
      />

      {/* JSON Import/Export Modal */}
      <ImportExportModal
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
        currentState={appState}
        onRestoreState={(restoredState) => setAppState(restoredState)}
      />
    </div>
  );
};

export default App;
