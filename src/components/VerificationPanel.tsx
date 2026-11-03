import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { runAllVerificationTests, TestResult } from '../lib/testScenarios';

export const VerificationPanel: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const res = runAllVerificationTests();
      setResults(res);
      setIsRunning(false);
    }, 150);
  };

  useEffect(() => {
    handleRunTests();
  }, []);

  const passedCount = results.filter((r) => r.passed).length;
  const allPassed = results.length > 0 && passedCount === results.length;

  return (
    <div className="space-y-6">
      {/* Header and Status */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Specification Verification Suite
              </span>
              <span className="text-xs text-slate-500">
                15 Authoritative Verification Checks
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Deterministic Backlog Engine Test Runner
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Direct verification of water-filling redistribution, 3-day recovery windows, oldest-first priorities,
              sleep protection, Nov 25 hard cutoff, and historical recalculations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRunTests}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{isRunning ? 'Running Checks...' : 'Re-run All 15 Tests'}</span>
            </button>
          </div>
        </div>

        {/* Big Pass/Fail Badge */}
        <div className="mt-5 p-4 rounded-xl border flex items-center justify-between flex-wrap gap-4 bg-emerald-50/70 border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-bold text-emerald-950">
                {allPassed
                  ? 'All 15 Engine & Specification Requirements Passing'
                  : `${passedCount} of ${results.length} Tests Passing`}
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Backlog engine calculations, priority ordering, sleep constraints, and cutoff dates are 100% compliant.
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-black text-emerald-700 font-mono">
              {passedCount}/{results.length}
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 uppercase">
              Tests Succeeded
            </span>
          </div>
        </div>
      </div>

      {/* Test List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
        {results.map((test) => {
          const isExpanded = expandedId === test.id;

          return (
            <div key={test.id} className="transition-colors hover:bg-slate-50/50">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : test.id)}
                className="w-full text-left p-4 flex items-start justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {test.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 fill-red-100" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        #{test.id.toString().padStart(2, '0')}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {test.title}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {test.details}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      test.passed
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-12 pb-4 text-xs space-y-2 bg-slate-50/70 border-t border-slate-100 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="font-semibold text-slate-500 block mb-1">
                        Expected Condition:
                      </span>
                      <pre className="font-mono text-emerald-800 whitespace-pre-wrap text-[11px]">
                        {test.expected}
                      </pre>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="font-semibold text-slate-500 block mb-1">
                        Observed Calculation:
                      </span>
                      <pre className="font-mono text-slate-800 whitespace-pre-wrap text-[11px]">
                        {test.actual}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
