import React, { useState } from 'react';
import {
  X,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { AppStateData } from '../types';
import {
  exportStateToJson,
  validateImportData,
  createSafetyBackup,
  restoreSafetyBackup,
} from '../lib/storage';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: AppStateData;
  onRestoreState: (state: AppStateData) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  currentState,
  onRestoreState,
}) => {
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [validatedData, setValidatedData] = useState<AppStateData | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [restoredSafetySuccess, setRestoredSafetySuccess] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    const jsonStr = exportStateToJson(currentState);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backlog-prep-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportJsonText(text);
      handleValidate(text);
    };
    reader.readAsText(file);
  };

  const handleValidate = (text: string) => {
    setImportError(null);
    setValidatedData(null);
    const res = validateImportData(text);
    if (!res.valid) {
      setImportError(res.error || 'Invalid JSON format.');
    } else if (res.data) {
      setValidatedData(res.data);
    }
  };

  const handleExecuteImport = () => {
    if (!validatedData) return;
    // 1. Create safety backup before restoring
    createSafetyBackup(currentState);
    // 2. Restore state
    onRestoreState(validatedData);
    setShowConfirmModal(false);
    onClose();
  };

  const handleRestoreSafety = () => {
    const backup = restoreSafetyBackup();
    if (backup) {
      onRestoreState(backup);
      setRestoredSafetySuccess(true);
      setTimeout(() => setRestoredSafetySuccess(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Backup & Data Management (JSON)
              </h2>
              <p className="text-xs text-slate-500">
                Export and import your study plans, task completions, and backlog recovery records.
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

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Export Section */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Export Current Backup
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Saves all 28-day timetable plans, custom tasks, completions, and recovery sessions as a validated JSON file.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON Backup</span>
            </button>
          </div>

          {/* Import Section */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Import JSON Backup
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload a JSON backup or paste its content below. An automatic safety backup of your current state is created before restoring.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold border border-slate-300 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Choose JSON File</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-slate-400">or paste JSON code below</span>
            </div>

            <textarea
              rows={5}
              value={importJsonText}
              onChange={(e) => {
                setImportJsonText(e.target.value);
                handleValidate(e.target.value);
              }}
              placeholder='Paste JSON here (e.g. { "schemaVersion": 1, ... })'
              className="w-full font-mono text-xs p-3 border border-slate-300 rounded-xl bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />

            {/* Validation Feedback */}
            {importError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Import Validation Failed:</strong> {importError}
                </div>
              </div>
            )}

            {validatedData && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Valid Backup (Schema v{validatedData.schemaVersion}, {Object.keys(validatedData.timetableByDate || {}).length} days, {validatedData.backlogSessions?.length || 0} recovery sessions).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Restore This Backup
                </button>
              </div>
            )}
          </div>

          {/* Safety Rollback */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Accidentally overwrote something?</span>
            <button
              type="button"
              onClick={handleRestoreSafety}
              className="text-blue-600 hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Pre-Import Safety Backup</span>
            </button>
          </div>

          {restoredSafetySuccess && (
            <div className="text-xs text-emerald-700 font-semibold text-right">
              Pre-import safety backup successfully restored!
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Sub-Modal before overwriting */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">
                Confirm Overwrite
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Restoring this backup will replace current plans, task completions, and backlog sessions with the imported file.
              An automatic safety copy will be preserved in your browser memory so you can revert if needed.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs cursor-pointer"
              >
                Yes, Restore Backup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
