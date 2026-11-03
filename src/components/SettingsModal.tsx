import React, { useState } from 'react';
import { X, Settings, Calendar, Shield, Save, AlertTriangle } from 'lucide-react';
import { AppSettings } from '../types';
import { DateKey, getBacklogRecoveryCutoff, daysBetween } from '../lib/backlogEngine';
import { APP_TIMEZONE } from '../lib/dateUtils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  currentKolkataDate: DateKey;
  onSave: (newSettings: Partial<AppSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  currentKolkataDate,
  onSave,
}) => {
  const [startDate, setStartDate] = useState(settings.startDate);
  const [targetDate, setTargetDate] = useState(settings.targetDate);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const calculatedCutoff = targetDate ? getBacklogRecoveryCutoff(targetDate) : '';
  const totalDays = startDate && targetDate && targetDate >= startDate
    ? daysBetween(startDate, targetDate) + 1
    : 0;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!startDate || !targetDate) {
      setError('Please provide valid start and target dates.');
      return;
    }

    if (targetDate < startDate) {
      setError('Examination target date cannot be earlier than study start date.');
      return;
    }

    const cutoffDate = getBacklogRecoveryCutoff(targetDate);

    onSave({
      startDate,
      targetDate,
      cutoffDate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Examination & Study Timeline Settings
              </h2>
              <p className="text-xs text-slate-500">
                Configure your study period boundaries and review the dynamic clock.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Active Dynamic Device Clock Card */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
            <div className="flex items-center justify-between font-bold text-blue-900 mb-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                Active Device Clock ({APP_TIMEZONE})
              </span>
              <span className="font-mono text-sm bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-800">
                {currentKolkataDate}
              </span>
            </div>
            <p className="text-blue-700/90 leading-relaxed">
              Dynamically retrieved from your device clock using the <strong>{APP_TIMEZONE}</strong> Indian calendar date. It refreshes automatically across midnight and on tab focus.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Start Date */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Configured Study Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:border-blue-500 bg-white text-slate-900"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              The first day of your syllabus schedule (Default: 2026-11-03).
            </p>
          </div>

          {/* Target Examination Date */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Configured Examination Target Date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:border-blue-500 bg-white text-slate-900"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Examination date (Default: 2026-11-30). Total study period: <strong>{totalDays} days</strong>.
            </p>
          </div>

          {/* Automatic Recovery Cutoff Info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Calculated Recovery Cutoff:</span>
              <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                {calculatedCutoff}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Strictly fixed at 5 calendar days before the examination (inclusive). Backlogs cannot recover after this cutoff.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
