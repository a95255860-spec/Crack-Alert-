import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Sliders, Check } from 'lucide-react';
import { CalibrationThresholds } from '../types/shm';
import { DEFAULT_CALIBRATION } from '../utils/shmEngine';

interface CalibrationModalProps {
  isOpen: boolean;
  calibration: CalibrationThresholds;
  onClose: () => void;
  onSave: (next: CalibrationThresholds) => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  calibration,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<CalibrationThresholds>(calibration);

  useEffect(() => {
    if (isOpen) setDraft(calibration);
  }, [isOpen, calibration]);

  if (!isOpen) return null;

  const updateField = (key: keyof CalibrationThresholds, raw: string) => {
    const val = Number(raw);
    if (!Number.isFinite(val)) return;
    setDraft((prev) => ({ ...prev, [key]: Math.max(0, Math.min(1023, val)) }));
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibration-modal-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-[#0B1221] p-5 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3.5">
          <div>
            <h2
              id="calibration-modal-title"
              className="font-display text-base font-bold text-white flex items-center gap-2"
            >
              <Sliders className="h-4 w-4 text-cyan-400" />
              <span>إعدادات معايرة نطاقات الخطورة (Calibration Settings)</span>
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              معايرة دقيقة لحدود التصنيف الصوتي غير المتداخلة وفقاً للجدول التجريبي (الافتراضي: إنذار 5–15، اشتباه 16–20، طبيعي &gt;20 مثل 21–50+).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Visual Spectrum Preview */}
        <div className="mt-4 rounded-lg border border-slate-800 bg-[#070B14] p-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>مخطط توزيع نطاقات القراءات الصوتية غير المتداخلة</span>
            <span className="font-mono-num" dir="ltr">AE Scale</span>
          </div>
          <div className="flex h-6 w-full overflow-hidden rounded-md text-[10px] font-bold font-mono-num" dir="ltr">
            <div
              className="flex items-center justify-center bg-red-500/35 text-red-200 border-r border-red-500/60"
              style={{ width: '32%' }}
            >
              Alarm {draft.alarmMin}–{draft.alarmMax}
            </div>
            <div
              className="flex items-center justify-center bg-blue-500/35 text-blue-200 border-r border-blue-500/60"
              style={{ width: '24%' }}
            >
              Suspicious {draft.suspiciousMin}–{draft.suspiciousMax}
            </div>
            <div
              className="flex items-center justify-center bg-emerald-500/30 text-emerald-200"
              style={{ width: '44%' }}
            >
              Normal &gt;{draft.suspiciousMax} ({draft.normalMin}–{draft.normalMax}+)
            </div>
          </div>
        </div>

        {/* Editable Min/Max Boundaries */}
        <div className="mt-4 space-y-3">
          {/* Alarm Tier */}
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-red-400">
              <span>✖ حالة إنذار — خطر مرتفع (Alarm)</span>
              <span className="font-mono-num text-[11px] font-normal text-slate-400">
                انتشار شرخ نشط
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">الحد الأدنى (Min)</label>
                <input
                  type="number"
                  value={draft.alarmMin}
                  onChange={(e) => updateField('alarmMin', e.target.value)}
                  className="font-mono-num w-full rounded-md border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-white focus:border-red-400 focus:outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">الحد الأعلى (Max)</label>
                <input
                  type="number"
                  value={draft.alarmMax}
                  onChange={(e) => updateField('alarmMax', e.target.value)}
                  className="font-mono-num w-full rounded-md border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-white focus:border-red-400 focus:outline-none"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Suspicious Tier */}
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-blue-400">
              <span>▲ حالة اشتباه — خطر متوسط (Suspicious)</span>
              <span className="font-mono-num text-[11px] font-normal text-slate-400">
                تراكم إجهاد مبكر
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">الحد الأدنى (Min)</label>
                <input
                  type="number"
                  value={draft.suspiciousMin}
                  onChange={(e) => updateField('suspiciousMin', e.target.value)}
                  className="font-mono-num w-full rounded-md border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">الحد الأعلى (Max)</label>
                <input
                  type="number"
                  value={draft.suspiciousMax}
                  onChange={(e) => updateField('suspiciousMax', e.target.value)}
                  className="font-mono-num w-full rounded-md border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Normal Tier */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-emerald-400">
              <span>● حالة طبيعية — آمنة (Normal)</span>
              <span className="font-mono-num text-[11px] font-normal text-slate-400">
                قراءات مستقرة
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">الحد الأدنى (Min)</label>
                <input
                  type="number"
                  value={draft.normalMin}
                  onChange={(e) => updateField('normalMin', e.target.value)}
                  className="font-mono-num w-full rounded-md border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">الحد الأعلى (Max)</label>
                <input
                  type="number"
                  value={draft.normalMax}
                  onChange={(e) => updateField('normalMax', e.target.value)}
                  className="font-mono-num w-full rounded-md border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setDraft({ ...DEFAULT_CALIBRATION })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#080E1B] px-3 py-2 text-xs font-medium text-slate-300 hover:border-cyan-500/50 hover:text-white cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 text-cyan-400" />
            <span>استعادة الإعدادات التجريبية (5–15 / 16–20 / 21–50)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>حفظ المعايرة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
