import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  Coffee,
  BookOpen,
  Check,
  Save,
  AlertCircle,
} from 'lucide-react';
import { TimetableItem } from '../types';
import { DateKey, formatMinutes } from '../lib/backlogEngine';

interface TimetableEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDateKey?: DateKey | null; // if null, editing recurring template
  initialItems: TimetableItem[];
  onSave: (items: TimetableItem[], scope: 'single' | 'future' | 'template') => void;
}

const COMMON_SUBJECTS = ['DSA', 'Question Paper Solving', 'Revision', 'FastAPI', 'Break', 'Custom'];

export const TimetableEditorModal: React.FC<TimetableEditorModalProps> = ({
  isOpen,
  onClose,
  targetDateKey,
  initialItems,
  onSave,
}) => {
  const [items, setItems] = useState<TimetableItem[]>(() => JSON.parse(JSON.stringify(initialItems)));
  const [scope, setScope] = useState<'single' | 'future' | 'template'>(
    targetDateKey ? 'single' : 'template',
  );

  if (!isOpen) return null;

  const handleAddItem = (isBreak = false) => {
    const newId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newItem: TimetableItem = {
      id: newId,
      startTime: '10:00',
      endTime: '11:00',
      title: isBreak ? 'Break' : 'New Study Block',
      subject: isBreak ? 'Break' : 'DSA',
      durationMinutes: 60,
      isBreak,
      completed: false,
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (id: string, updates: Partial<TimetableItem>) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        if (updates.subject === 'Break') {
          updated.isBreak = true;
        } else if (updates.subject && updates.subject !== 'Break' && item.isBreak) {
          updated.isBreak = false;
        }
        return updated;
      }),
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setItems(next);
  };

  const totalStudyMinutes = items
    .filter((i) => !i.isBreak)
    .reduce((sum, i) => sum + i.durationMinutes, 0);

  const totalBreakMinutes = items
    .filter((i) => i.isBreak)
    .reduce((sum, i) => sum + i.durationMinutes, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(items, scope);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {targetDateKey ? `Edit Timetable for ${targetDateKey}` : 'Edit Timetable Template'}
            </h2>
            <p className="text-xs text-slate-500">
              Customize blocks, subjects, durations, and start/end times.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Totals Summary */}
        <div className="px-6 py-2.5 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between text-xs text-slate-700">
          <div className="flex items-center gap-4">
            <span>
              Total Planned Study: <strong className="text-blue-900">{formatMinutes(totalStudyMinutes)}</strong>
            </span>
            <span>
              Total Breaks: <strong className="text-slate-900">{formatMinutes(totalBreakMinutes)}</strong>
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            {items.length} total schedule blocks
          </span>
        </div>

        {/* Schedule Items List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                item.isBreak
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-white border-blue-200/80 shadow-2xs'
              }`}
            >
              {/* Left: Reorder buttons & item details */}
              <div className="flex items-center gap-2 flex-1">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1}
                    onClick={() => handleMove(index, 'down')}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-1">
                  {/* Title */}
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                      placeholder="Activity Title"
                      className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-300 rounded-md focus:border-blue-500 bg-white"
                    />
                  </div>

                  {/* Subject */}
                  <div>
                    <select
                      value={item.subject}
                      onChange={(e) => handleUpdateItem(item.id, { subject: e.target.value })}
                      className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-md focus:border-blue-500 bg-white"
                    >
                      {COMMON_SUBJECTS.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Duration in Minutes */}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="5"
                      max="480"
                      step="5"
                      value={item.durationMinutes}
                      onChange={(e) =>
                        handleUpdateItem(item.id, {
                          durationMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-16 text-xs text-right px-2 py-1.5 border border-slate-300 rounded-md bg-white font-mono"
                    />
                    <span className="text-xs text-slate-500">min</span>
                  </div>
                </div>
              </div>

              {/* Right: Time clock + Delete */}
              <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={item.startTime}
                    onChange={(e) => handleUpdateItem(item.id, { startTime: e.target.value })}
                    className="w-14 text-[11px] text-center px-1 py-1 border border-slate-200 rounded bg-white font-mono"
                    placeholder="06:00"
                  />
                  <span className="text-xs text-slate-400">–</span>
                  <input
                    type="text"
                    value={item.endTime}
                    onChange={(e) => handleUpdateItem(item.id, { endTime: e.target.value })}
                    className="w-14 text-[11px] text-center px-1 py-1 border border-slate-200 rounded bg-white font-mono"
                    placeholder="08:30"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                  title="Delete Block"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Add block buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleAddItem(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Study Task</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddItem(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg border border-slate-200 cursor-pointer"
            >
              <Coffee className="w-4 h-4" />
              <span>Add Break Block</span>
            </button>
          </div>
        </div>

        {/* Modal Footer with Scope selection */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {targetDateKey ? (
            <div className="flex items-center gap-4 text-xs">
              <span className="font-semibold text-slate-700">Apply Changes To:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="single"
                  checked={scope === 'single'}
                  onChange={() => setScope('single')}
                  className="text-blue-600"
                />
                <span>This day only ({targetDateKey})</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="future"
                  checked={scope === 'future'}
                  onChange={() => setScope('future')}
                  className="text-blue-600"
                />
                <span>This day and all future days</span>
              </label>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Saving will update the master reusable template.
            </div>
          )}

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Timetable</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
