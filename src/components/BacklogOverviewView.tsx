import React, { useState } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  TrendingDown,
  Info,
  Calendar,
} from 'lucide-react';
import {
  BacklogBatchSummary,
  BacklogAllocation,
  formatMinutes,
  DateKey,
} from '../lib/backlogEngine';

interface BacklogOverviewViewProps {
  batches: BacklogBatchSummary[];
  allocations: BacklogAllocation[];
  todayDate: DateKey;
  cutoffDate: DateKey;
}

export const BacklogOverviewView: React.FC<BacklogOverviewViewProps> = ({
  batches,
  allocations,
  todayDate,
  cutoffDate,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'expired'>('all');

  const filteredBatches = batches.filter((b) => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  const totalOriginal = batches.reduce((sum, b) => sum + b.originalMinutes, 0);
  const totalRecovered = batches.reduce((sum, b) => sum + b.recoveredMinutes, 0);
  const totalPending = batches.reduce((sum, b) => sum + b.pendingMinutes, 0);
  const totalProjectedDiscard = batches.reduce((sum, b) => sum + b.projectedDiscardMinutes, 0);
  const totalDiscarded = batches.reduce((sum, b) => sum + b.discardedMinutes, 0);

  // Helper to find next scheduled recovery date
  const getNextScheduledDate = (batchId: string): string => {
    const futureAllocs = allocations.filter(
      (a) => a.batchId === batchId && !a.completed && a.date >= todayDate,
    );
    if (futureAllocs.length === 0) return 'None';
    return futureAllocs[0].date;
  };

  return (
    <div className="space-y-6">
      {/* Overview explanation card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                Authoritative Backlog Ledger
              </span>
              <span className="text-xs text-slate-500">
                3-Day Sliding Windows • Hard Cutoff: {cutoffDate}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Backlog Batches & Recovery Audit
            </h2>
          </div>

          {/* Quick status counters */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                filter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All ({batches.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                filter === 'active'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Active ({batches.filter((b) => b.status === 'active').length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                filter === 'completed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Recovered ({batches.filter((b) => b.status === 'completed').length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('expired')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                filter === 'expired'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-800 hover:bg-red-100'
              }`}
            >
              Expired ({batches.filter((b) => b.status === 'expired').length})
            </button>
          </div>
        </div>

        {/* Clear explanation of Projected Discard vs Permanent Discard */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-900">Projected Discard:</strong> A forecast of pending minutes that currently cannot fit into the remaining free time before expiry. If future day plans free up capacity, these hours can still be recovered.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <TrendingDown className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-red-900">Permanent Discard:</strong> Definitive loss recorded only after the 3-day recovery window closes or when a task is missed after the November 25 cutoff. Expired backlog is never carried forward.
            </div>
          </div>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredBatches.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              No Backlog Batches Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {filter === 'all'
                ? 'All study tasks on past dates were completed, or no study days have elapsed yet.'
                : `No batches match the "${filter}" filter.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Source Date</th>
                  <th className="py-3 px-4">Subject & Task</th>
                  <th className="py-3 px-3 text-right">Original</th>
                  <th className="py-3 px-3 text-right text-emerald-700">Recovered</th>
                  <th className="py-3 px-3 text-right text-amber-700">Pending</th>
                  <th className="py-3 px-4">Next Recovery</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-3 text-right text-amber-800">Proj. Discard</th>
                  <th className="py-3 px-3 text-right text-red-700">Perm. Discard</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.map((batch) => {
                  const nextDate = getNextScheduledDate(batch.id);
                  const isExpiringSoon = batch.expiryDate === todayDate;

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Source Date */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {batch.sourceDate}
                      </td>

                      {/* Subject & Task */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {batch.taskTitle}
                        </div>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 mt-0.5">
                          {batch.subject}
                        </span>
                      </td>

                      {/* Original Duration */}
                      <td className="py-3.5 px-3 text-right font-medium text-slate-800 whitespace-nowrap">
                        {formatMinutes(batch.originalMinutes)}
                      </td>

                      {/* Recovered */}
                      <td className="py-3.5 px-3 text-right font-semibold text-emerald-600 whitespace-nowrap">
                        {batch.recoveredMinutes > 0 ? formatMinutes(batch.recoveredMinutes) : '—'}
                      </td>

                      {/* Pending */}
                      <td className="py-3.5 px-3 text-right font-semibold text-amber-700 whitespace-nowrap">
                        {batch.pendingMinutes > 0 ? formatMinutes(batch.pendingMinutes) : '0 min'}
                      </td>

                      {/* Next Scheduled */}
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        {nextDate !== 'None' ? (
                          <span className="font-mono text-xs font-semibold text-blue-700">
                            {nextDate}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Expiry Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`font-mono font-medium ${
                            isExpiringSoon
                              ? 'text-red-700 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-200'
                              : 'text-slate-700'
                          }`}
                        >
                          {batch.expiryDate}
                        </span>
                      </td>

                      {/* Projected Discard */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {batch.projectedDiscardMinutes > 0 ? (
                          <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            {formatMinutes(batch.projectedDiscardMinutes)}
                          </span>
                        ) : (
                          <span className="text-slate-300">0 min</span>
                        )}
                      </td>

                      {/* Permanent Discard */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {batch.discardedMinutes > 0 ? (
                          <span className="font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                            {formatMinutes(batch.discardedMinutes)}
                          </span>
                        ) : (
                          <span className="text-slate-300">0 min</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {batch.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Recovered
                          </span>
                        )}
                        {batch.status === 'active' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" />
                            Active
                          </span>
                        )}
                        {batch.status === 'expired' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                            <TrendingDown className="w-3 h-3" />
                            Expired
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200">
                <tr>
                  <td colSpan={2} className="py-3 px-4">
                    Totals across {filteredBatches.length} batch{filteredBatches.length > 1 ? 'es' : ''}
                  </td>
                  <td className="py-3 px-3 text-right">{formatMinutes(totalOriginal)}</td>
                  <td className="py-3 px-3 text-right text-emerald-700">{formatMinutes(totalRecovered)}</td>
                  <td className="py-3 px-3 text-right text-amber-700">{formatMinutes(totalPending)}</td>
                  <td colSpan={2}></td>
                  <td className="py-3 px-3 text-right text-amber-800">{formatMinutes(totalProjectedDiscard)}</td>
                  <td className="py-3 px-3 text-right text-red-700">{formatMinutes(totalDiscarded)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
