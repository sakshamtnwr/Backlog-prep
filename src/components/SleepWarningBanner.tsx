import React from 'react';
import { AlertTriangle, Moon, Check, X, Sliders } from 'lucide-react';

interface SleepWarningBannerProps {
  dismissed: boolean;
  onDismiss: () => void;
  onOpenTemplateEditor: () => void;
}

export const SleepWarningBanner: React.FC<SleepWarningBannerProps> = ({
  dismissed,
  onDismiss,
  onOpenTemplateEditor,
}) => {
  if (dismissed) return null;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg shadow-2xs">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-1 rounded bg-amber-100 text-amber-700 mt-0.5">
            <Moon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-amber-900">
                Sleep Schedule Conflict Advisory (6h Clock Interval vs 7h Protected Sleep)
              </h3>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                Notice
              </span>
            </div>
            <p className="text-xs text-amber-800 mt-1 max-w-3xl leading-relaxed">
              The predefined daily timetable ends at <strong>00:00 (midnight)</strong> and restarts at <strong>06:00</strong>, which provides <strong>6.0 hours</strong> between scheduled blocks.
              However, the backlog calculation engine <strong>strictly protects 7.0 hours (420 minutes)</strong> of daily sleep in its free-time formula and will never compromise this allowance.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              You can adjust start/end times in the Timetable Template (e.g., start at 07:00 or end at 23:00) or keep the schedule as-is.
            </p>
            <div className="mt-2.5 flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenTemplateEditor}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Adjust Timetable</span>
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs font-medium text-amber-800 hover:text-amber-950 underline cursor-pointer"
              >
                I understand, dismiss advisory
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="text-amber-600 hover:text-amber-800 p-1 cursor-pointer"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
