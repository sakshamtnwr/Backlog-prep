import { AppStateData } from '../types';
import { getInitialAppState } from './initialData';

const STORAGE_KEY = 'backlog_prep_state_v1';
const SAFETY_BACKUP_KEY = 'backlog_prep_safety_backup';

export function loadAppState(): AppStateData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getInitialAppState();
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.schemaVersion) {
      // Ensure all fields exist
      const initial = getInitialAppState();
      return {
        ...initial,
        ...parsed,
        settings: { ...initial.settings, ...(parsed.settings || {}) },
        timetableByDate: parsed.timetableByDate || initial.timetableByDate,
        fixedCommitmentsByDate: parsed.fixedCommitmentsByDate || initial.fixedCommitmentsByDate,
        joyTaskByDate: parsed.joyTaskByDate || initial.joyTaskByDate,
        backlogSessions: Array.isArray(parsed.backlogSessions) ? parsed.backlogSessions : [],
      };
    }
  } catch (err) {
    console.error('Failed to load state from localStorage:', err);
  }
  return getInitialAppState();
}

export function saveAppState(state: AppStateData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
}

export function createSafetyBackup(state: AppStateData): void {
  try {
    localStorage.setItem(SAFETY_BACKUP_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to create safety backup:', err);
  }
}

export function restoreSafetyBackup(): AppStateData | null {
  try {
    const raw = localStorage.getItem(SAFETY_BACKUP_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to restore safety backup:', err);
  }
  return null;
}

export function exportStateToJson(state: AppStateData): string {
  const exportPayload: AppStateData = {
    ...state,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(exportPayload, null, 2);
}

export function validateImportData(jsonStr: string): {
  valid: boolean;
  error?: string;
  data?: AppStateData;
} {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'File is not a valid JSON object.' };
    }
    if (!parsed.schemaVersion) {
      return { valid: false, error: 'Missing schemaVersion in import file.' };
    }
    if (!parsed.settings?.startDate || !parsed.settings?.targetDate) {
      return { valid: false, error: 'Missing start or target date in settings.' };
    }
    if (!parsed.timetableByDate || typeof parsed.timetableByDate !== 'object') {
      return { valid: false, error: 'Missing timetableByDate schedule object.' };
    }
    if (!Array.isArray(parsed.backlogSessions)) {
      return { valid: false, error: 'Missing or invalid backlogSessions list.' };
    }

    return { valid: true, data: parsed as AppStateData };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Invalid JSON syntax: ${message}` };
  }
}

export function resetToDefaults(): AppStateData {
  const initial = getInitialAppState();
  saveAppState(initial);
  return initial;
}
