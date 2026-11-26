import React from 'react';
import {
  Play,
  Square,
  AlertTriangle,
  ShieldCheck,
  AlertOctagon,
  X,
  Zap,
} from 'lucide-react';
import {
  CalibrationThresholds,
  ConnectionMode,
  SensorNode,
  SeverityLevel,
} from '../types/shm';

interface SimulationToolbarProps {
  connectionMode: ConnectionMode;
  autoStream: boolean;
  onToggleAutoStream: () => void;
  onTriggerSample: (severity: SeverityLevel) => void;
  sensors: SensorNode[];
  selectedSensorId: string;
  onSelectSensor: (id: string) => void;
  calibration: CalibrationThresholds;
  serialError: string | null;
  onClearSerialError: () => void;
  onEnableSimulation: () => void;
}

export const SimulationToolbar: React.FC<SimulationToolbarProps> = ({
  connectionMode,
  autoStream,
  onToggleAutoStream,
  onTriggerSample,
  sensors,
  selectedSensorId,
  onSelectSensor,
  calibration,
  serialError,
  onClearSerialError,
  onEnableSimulation,
}) => {
  return (
    <div className="no-print border-b border-slate-800/70 bg-[#0A101D]">
      <div className="mx-auto max-w-[1600px] px-4 py-2.5 lg:px-6">
        {serialError && (
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{serialError}</span>
            </div>
            <div className="flex items-center gap-2">
              {connectionMode !== 'simulation' && (
                <button
                  type="button"
                  onClick={() => {
                    onEnableSimulation();
                    onClearSerialError();
                  }}
                  className="rounded-md bg-cyan-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer whitespace-nowrap"
                >
                  تفعيل وضع المحاكاة الآن
                </button>
              )}
              <button
                type="button"
                onClick={onClearSerialError}
                aria-label="إغلاق التنبيه"
                className="rounded p-1 text-amber-300/80 hover:bg-amber-500/20 hover:text-amber-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Simulation Triggers */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 whitespace-nowrap">
              <Zap className="h-3.5 w-3.5 text-cyan-400" />
              <span>محاكاة الاختبار الفوري:</span>
            </span>

            <button
              type="button"
              onClick={() => onTriggerSample('normal')}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/12 px-3 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/22 whitespace-nowrap cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>حالة طبيعية</span>
              <span className="font-mono-num text-[11px] opacity-80" dir="ltr">
                (&gt;{calibration.suspiciousMax} · {calibration.normalMin}–{calibration.normalMax}+)
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTriggerSample('suspicious')}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-blue-500/45 bg-blue-500/14 px-3 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/25 whitespace-nowrap cursor-pointer"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>حالة اشتباه</span>
              <span className="font-mono-num text-[11px] opacity-80" dir="ltr">
                ({calibration.suspiciousMin}–{calibration.suspiciousMax})
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTriggerSample('alarm')}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-500/50 bg-red-500/15 px-3 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/28 whitespace-nowrap cursor-pointer"
            >
              <AlertOctagon className="h-3.5 w-3.5" />
              <span>حالة إنذار</span>
              <span className="font-mono-num text-[11px] opacity-80" dir="ltr">
                ({calibration.alarmMin}–{calibration.alarmMax})
              </span>
            </button>
          </div>

          {/* Target Sensor + Continuous Stream */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="target-sensor-select" className="text-slate-400 whitespace-nowrap">
                الحساس النشط:
              </label>
              <select
                id="target-sensor-select"
                value={selectedSensorId}
                onChange={(e) => onSelectSensor(e.target.value)}
                className="h-8 rounded-md border border-slate-700 bg-[#0D1526] px-2.5 text-xs font-medium text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                {sensors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onToggleAutoStream}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                autoStream
                  ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30'
                  : 'border-slate-700 bg-[#0D1526] text-slate-300 hover:border-cyan-500/40 hover:text-white'
              }`}
            >
              {autoStream ? (
                <>
                  <Square className="h-3 w-3 fill-current" />
                  <span>إيقاف البث التلقائي</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 fill-current" />
                  <span>بث محاكاة مستمر</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
