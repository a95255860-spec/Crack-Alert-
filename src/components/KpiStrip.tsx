import React from 'react';
import {
  Activity,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Gauge,
  BarChart2,
} from 'lucide-react';
import {
  CalibrationThresholds,
  SensorNode,
  SeverityLevel,
  SpecimenDimensions,
} from '../types/shm';
import { SEVERITY_META } from '../utils/shmEngine';

interface KpiStripProps {
  latestReading: number | null;
  latestSeverity: SeverityLevel;
  activeSensor: SensorNode | undefined;
  counts: { normal: number; suspicious: number; alarm: number };
  healthIndex: number;
  dimensions: SpecimenDimensions;
  calibration: CalibrationThresholds;
}

export const KpiStrip: React.FC<KpiStripProps> = ({
  latestReading,
  latestSeverity,
  activeSensor,
  counts,
  healthIndex,
  dimensions,
  calibration,
}) => {
  const sevMeta = SEVERITY_META[latestSeverity];
  const depthUm = activeSensor?.estimatedDepthUm ?? 0;
  const thicknessUm = Math.max(1000, dimensions.thickness * 1000);
  const depthPct = ((depthUm / thicknessUm) * 100).toFixed(2);
  const totalEvents = counts.normal + counts.suspicious + counts.alarm;

  const SeverityIcon =
    latestSeverity === 'alarm'
      ? ShieldAlert
      : latestSeverity === 'suspicious'
        ? AlertTriangle
        : ShieldCheck;

  const healthColor =
    healthIndex >= 80 ? '#10B981' : healthIndex >= 55 ? '#3B82F6' : '#EF4444';

  return (
    <section
      aria-label="مؤشرات الأداء اللحظية"
      className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5"
    >
      {/* KPI 1: Live Reading Value */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0C1322] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>القراءة الصوتية اللحظية</span>
          <Activity className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span
            className="font-mono-num text-3xl font-bold tracking-tight"
            style={{ color: latestReading !== null ? sevMeta.color : '#94A3B8' }}
          >
            {latestReading !== null ? latestReading : '--'}
          </span>
          <span className="font-mono-num text-xs text-slate-400" dir="ltr">
            AE Peak
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <span className="truncate">{activeSensor?.name ?? 'لا يوجد حساس'}</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="font-mono-num text-[11px] text-cyan-400" dir="ltr">
            {activeSensor?.id ?? '--'}
          </span>
        </div>
      </div>

      {/* KPI 2: Severity Status */}
      <div
        className="rounded-xl border bg-[#0C1322] p-4 transition-colors"
        style={{
          borderColor:
            latestSeverity === 'alarm'
              ? 'rgba(239, 68, 68, 0.5)'
              : latestSeverity === 'suspicious'
                ? 'rgba(59, 130, 246, 0.45)'
                : 'rgba(30, 41, 59, 0.9)',
        }}
      >
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>مستوى الخطورة الإنشائية</span>
          <SeverityIcon className="h-4 w-4" style={{ color: sevMeta.color }} />
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <span
            className="font-display text-2xl font-bold"
            style={{ color: sevMeta.color }}
          >
            {sevMeta.labelAr}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono-num text-[11px]" dir="ltr">
            {sevMeta.labelEn}
          </span>
          <span className="font-mono-num text-[11px] text-slate-500" dir="ltr">
            {latestSeverity === 'alarm'
              ? `${calibration.alarmMin}–${calibration.alarmMax}`
              : latestSeverity === 'suspicious'
                ? `${calibration.suspiciousMin}–${calibration.suspiciousMax}`
                : `>${calibration.suspiciousMax} (${calibration.normalMin}–${calibration.normalMax}+)`}
          </span>
        </div>
      </div>

      {/* KPI 3: Estimated Micro-Crack Depth */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0C1322] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>عمق الشرخ المايكرومتري</span>
          <Layers className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span
            className="font-mono-num text-3xl font-bold tracking-tight"
            style={{
              color:
                depthUm >= 50 ? '#EF4444' : depthUm >= 15 ? '#3B82F6' : '#10B981',
            }}
          >
            {depthUm}
          </span>
          <span className="font-mono-num text-sm font-medium text-slate-400" dir="ltr">
            µm
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>نسبة الاختراق للسماكة</span>
          <span className="font-mono-num text-[11px] text-slate-300" dir="ltr">
            {depthPct}% ({dimensions.thickness} mm)
          </span>
        </div>
      </div>

      {/* KPI 4: Total Detected Events Breakdown */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0C1322] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>توزيع الأحداث المرصودة</span>
          <BarChart2 className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2 border-b border-slate-800/80 pb-2 text-center">
          <div>
            <div className="font-mono-num text-lg font-bold text-emerald-400">
              {counts.normal}
            </div>
            <div className="text-[11px] text-slate-400">طبيعية</div>
          </div>
          <div>
            <div className="font-mono-num text-lg font-bold text-blue-400">
              {counts.suspicious}
            </div>
            <div className="text-[11px] text-slate-400">اشتباه</div>
          </div>
          <div>
            <div className="font-mono-num text-lg font-bold text-red-400">
              {counts.alarm}
            </div>
            <div className="text-[11px] text-slate-400">إنذار</div>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
          <span>إجمالي القراءات</span>
          <span className="font-mono-num font-semibold text-slate-200">{totalEvents}</span>
        </div>
      </div>

      {/* KPI 5: Structural Health Index */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0C1322] p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>مؤشر سلامة الهيكل</span>
          <Gauge className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="mt-2.5 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            <span
              className="font-mono-num text-3xl font-bold"
              style={{ color: healthColor }}
            >
              {healthIndex}
            </span>
            <span className="font-mono-num text-sm text-slate-400">%</span>
          </div>
          <span className="font-mono-num text-[11px] text-slate-500" dir="ltr">
            SHM Index
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800/90">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${healthIndex}%`,
              backgroundColor: healthColor,
            }}
          />
        </div>
      </div>
    </section>
  );
};
