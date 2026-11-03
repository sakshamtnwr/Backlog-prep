import React from 'react';
import {
  Calendar,
  Clock,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import { ActiveTab, AppSettings } from '../types';
import { DateKey, daysBetween } from '../lib/backlogEngine';
import { APP_TIMEZONE, getStudyPeriodInfo } from '../lib/dateUtils';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  settings: AppSettings;
  todayDate: DateKey; // The effective viewed/operated date
  currentKolkataDate: DateKey; // The live dynamic Asia/Kolkata date from clock
  isViewingDifferentDate: boolean;
  onDateChange: (newDate: DateKey) => void;
  onResetToCurrentDate: () => void;
  onOpenImportExport: () => void;
  onOpenSettings: () => void;
  onResetToDefaults: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  settings,
  todayDate,
  currentKolkataDate,
  isViewingDifferentDate,
  onDateChange,
  onResetToCurrentDate,
  onOpenImportExport,
  onOpenSettings,
  onResetToDefaults,
}) => {
  // Derive status from the live current date
  const livePeriodInfo = getStudyPeriodInfo(
    currentKolkataDate,
    settings.startDate,
    settings.targetDate,
  );

  // Status for the currently viewed date (if user navigated to inspect another day)
  const viewedPeriodInfo = getStudyPeriodInfo(
    todayDate,
    settings.startDate,
    settings.targetDate,
  );

  const handlePrevDay = () => {
    const d = new Date(todayDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    onDateChange(`${yr}-${mo}-${da}`);
  };

  const handleNextDay = () => {
    const d = new Date(todayDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    onDateChange(`${yr}-${mo}-${da}`);
  };

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar: branding, dynamic clock, and primary actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Backlog Prep
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  IST Dynamic ({APP_TIMEZONE})
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Start: {settings.startDate} • Exam: {settings.targetDate} (Cutoff: {settings.cutoffDate}) • 7h Sleep
              </p>
            </div>
          </div>

          {/* Dynamic Date & Day Navigator */}
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={handlePrevDay}
                title="Previous Day"
                className="p-1.5 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-2.5 py-0.5 text-center">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 justify-center">
                  <span>{todayDate}</span>
                  {isViewingDifferentDate ? (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded border border-amber-300">
                      Inspecting
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.2 rounded border border-emerald-300">
                      Today (IST)
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {viewedPeriodInfo.statusText}
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextDay}
                title="Next Day"
                className="p-1.5 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {isViewingDifferentDate && (
              <button
                type="button"
                onClick={onResetToCurrentDate}
                className="text-xs font-semibold px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                title={`Jump back to dynamic live Indian calendar date (${currentKolkataDate})`}
              >
                Today ({currentKolkataDate})
              </button>
            )}

            <div className="h-5 w-px bg-slate-200 hidden sm:block mx-1" />

            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              title="Configure examination and study dates"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            <button
              type="button"
              onClick={onOpenImportExport}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Backup</span>
            </button>

            <button
              type="button"
              onClick={onResetToDefaults}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Reset all data to default template"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2 scrollbar-none">
          <button
            type="button"
            onClick={() => onTabChange('today')}
            className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'today'
                ? 'bg-blue-50 text-blue-700 font-semibold border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Today's Plan & Workload
          </button>

          <button
            type="button"
            onClick={() => onTabChange('backlog')}
            className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'backlog'
                ? 'bg-blue-50 text-blue-700 font-semibold border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Backlog Ledger & Batches
          </button>

          <button
            type="button"
            onClick={() => onTabChange('calendar')}
            className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'calendar'
                ? 'bg-blue-50 text-blue-700 font-semibold border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Calendar & Historical Review
          </button>

          <button
            type="button"
            onClick={() => onTabChange('template')}
            className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'template'
                ? 'bg-blue-50 text-blue-700 font-semibold border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Timetable Template
          </button>

          <button
            type="button"
            onClick={() => onTabChange('verification')}
            className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'verification'
                ? 'bg-emerald-50 text-emerald-800 font-semibold border-b-2 border-emerald-600'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Engine Verification (15/15)</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
