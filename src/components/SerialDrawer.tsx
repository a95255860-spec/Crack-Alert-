import React, { useState } from 'react';
import {
  Terminal,
  ChevronUp,
  ChevronDown,
  Send,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { CalibrationThresholds, SerialConsoleEntry } from '../types/shm';
import { DEFAULT_CALIBRATION, SEVERITY_META } from '../utils/shmEngine';

interface SerialDrawerProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  baudRate: 115200 | 9600;
  entries: SerialConsoleEntry[];
  onClearConsole: () => void;
  onInjectManualLine: (line: string) => void;
  calibration: CalibrationThresholds;
  onChangeCalibration: (next: CalibrationThresholds) => void;
}

export const SerialDrawer: React.FC<SerialDrawerProps> = ({
  isOpen,
  onToggleOpen,
  baudRate,
  entries,
  onClearConsole,
  onInjectManualLine,
  calibration,
  onChangeCalibration,
}) => {
  const [manualInput, setManualInput] = useState('Micro-Crack Peak: 14');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    onInjectManualLine(manualInput.trim());
  };

  return (
    <div className="no-print fixed right-0 bottom-0 left-0 z-30 border-t border-slate-800 bg-[#080D18]/98 shadow-2xl">
      {/* Drawer Toggle Strip */}
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-2 lg:px-6">
        <button
          type="button"
          onClick={onToggleOpen}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-cyan-300 cursor-pointer"
        >
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span>وحدة التحكم التسلسلي ومعايرة العتبات (Serial Console &amp; Calibration)</span>
          <span className="font-mono-num text-[11px] text-slate-500" dir="ltr">
            {baudRate} baud ({baudRate === 9600 ? 'HC-05/06 BT' : 'USB'}) · {entries.length} lines
          </span>
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>

        <div className="hidden items-center gap-3 font-mono-num text-[11px] text-slate-400 md:flex" dir="ltr">
          <span className="text-red-400">
            Alarm: {calibration.alarmMin}–{calibration.alarmMax}
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-blue-400">
            Suspicious: {calibration.suspiciousMin}–{calibration.suspiciousMax}
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400">
            Normal: &gt;{calibration.suspiciousMax} ({calibration.normalMin}–{calibration.normalMax}+)
          </span>
        </div>
      </div>

      {/* Expandable Drawer Content */}
      {isOpen && (
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 border-t border-slate-800/80 px-4 py-3.5 lg:grid-cols-12 lg:px-6">
          {/* Raw Serial Monitor & Manual Line Tester */}
          <div className="flex flex-col lg:col-span-7">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">
                البيانات الخام الواردة من المنفذ (Raw Serial Stream)
              </span>
              <button
                type="button"
                onClick={onClearConsole}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-300 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                <span>مسح الطرفية</span>
              </button>
            </div>

            <div
              className="font-mono-num h-36 overflow-y-auto rounded-lg border border-slate-800 bg-[#05080F] p-2.5 text-[11px] leading-relaxed"
              dir="ltr"
            >
              {entries.length === 0 ? (
                <div className="text-slate-600">
                  Waiting for Web Serial packets (e.g. "Micro-Crack Peak: 14" or "S1:14,S2:25")...
                </div>
              ) : (
                entries.slice(0, 80).map((item) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <span className="shrink-0 text-slate-600">[{item.timestamp}]</span>
                    <span
                      className={
                        item.direction === 'sys'
                          ? 'text-cyan-400'
                          : item.direction === 'tx'
                            ? 'text-amber-300'
                            : item.severity
                              ? SEVERITY_META[item.severity].textClass
                              : 'text-slate-300'
                      }
                    >
                      {item.direction === 'rx' ? 'RX ◄ ' : item.direction === 'tx' ? 'TX ► ' : 'SYS • '}
                      {item.text}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Manual Packet Injector for testing Arduino string formats */}
            <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Micro-Crack Peak: 14 أو S1:12,S2:18"
                className="font-mono-num h-8 flex-1 rounded-md border border-slate-700 bg-[#05080F] px-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                dir="ltr"
              />
              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-cyan-500 px-3 text-xs font-bold text-slate-950 hover:bg-cyan-400 cursor-pointer whitespace-nowrap"
              >
                <Send className="h-3 w-3" />
                <span>إرسال اختبار</span>
              </button>
            </form>
          </div>

          {/* Quick Calibration Sliders */}
          <div className="flex flex-col justify-between rounded-lg border border-slate-800/80 bg-[#0B1221] p-3 lg:col-span-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                منزلقات المعايرة السريعة (Threshold Sliders)
              </span>
              <button
                type="button"
                onClick={() => onChangeCalibration({ ...DEFAULT_CALIBRATION })}
                className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>الافتراضي التجريبي</span>
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-red-400 font-semibold">الحد الأعلى للإنذار (Alarm Max)</span>
                  <span className="font-mono-num text-slate-200" dir="ltr">
                    {calibration.alarmMin} – {calibration.alarmMax}
                  </span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={25}
                  value={calibration.alarmMax}
                  onChange={(e) => {
                    const alarmMax = Number(e.target.value);
                    const suspiciousMin = alarmMax + 1;
                    const suspiciousMax = Math.max(suspiciousMin + 2, calibration.suspiciousMax);
                    onChangeCalibration({
                      ...calibration,
                      alarmMax,
                      suspiciousMin,
                      suspiciousMax,
                      normalMin: suspiciousMax + 1,
                    });
                  }}
                  className="mt-1 w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-blue-400 font-semibold">الحد الأعلى للاشتباه (Suspicious Max)</span>
                  <span className="font-mono-num text-slate-200" dir="ltr">
                    {calibration.suspiciousMin} – {calibration.suspiciousMax}
                  </span>
                </div>
                <input
                  type="range"
                  min={calibration.alarmMax + 2}
                  max={35}
                  value={calibration.suspiciousMax}
                  onChange={(e) => {
                    const suspiciousMax = Number(e.target.value);
                    onChangeCalibration({
                      ...calibration,
                      suspiciousMax,
                      normalMin: suspiciousMax + 1,
                    });
                  }}
                  className="mt-1 w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-emerald-400 font-semibold">الحد الأعلى للطبيعي (Normal Max)</span>
                  <span className="font-mono-num text-slate-200" dir="ltr">
                    {calibration.normalMin} – {calibration.normalMax}
                  </span>
                </div>
                <input
                  type="range"
                  min={calibration.normalMin + 5}
                  max={120}
                  value={calibration.normalMax}
                  onChange={(e) =>
                    onChangeCalibration({
                      ...calibration,
                      normalMax: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
