import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { Activity, PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { AcousticEvent, CalibrationThresholds } from '../types/shm';
import { SEVERITY_META } from '../utils/shmEngine';

interface TelemetryChartsProps {
  events: AcousticEvent[];
  calibration: CalibrationThresholds;
  counts: { normal: number; suspicious: number; alarm: number };
}

interface ChartPoint {
  index: number;
  time: string;
  reading: number;
  depthUm: number;
  sensorId: string;
  severity: 'normal' | 'suspicious' | 'alarm';
}

const WaveformDot = (props: {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
}) => {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  const color = SEVERITY_META[payload.severity].color;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={payload.severity === 'alarm' ? 4.5 : 3.2}
      fill={color}
      stroke="#070B14"
      strokeWidth={1.4}
    />
  );
};

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({
  events,
  calibration,
  counts,
}) => {
  const [distChartType, setDistChartType] = useState<'donut' | 'bar'>('donut');

  const waveformData: ChartPoint[] = useMemo(() => {
    const slice = events.slice(0, 45).reverse();
    return slice.map((ev, idx) => ({
      index: idx + 1,
      time: ev.timeLabel.slice(0, 8),
      reading: ev.reading,
      depthUm: ev.depthUm,
      sensorId: ev.sensorId,
      severity: ev.severity,
    }));
  }, [events]);

  const yDomainMax = useMemo(() => {
    const maxData = waveformData.reduce((acc, p) => Math.max(acc, p.reading), 0);
    return Math.max(calibration.normalMax + 5, Math.ceil((maxData + 5) / 10) * 10);
  }, [waveformData, calibration.normalMax]);

  const distributionData = useMemo(
    () => [
      {
        key: 'normal',
        name: 'حالات طبيعية',
        nameEn: 'Normal',
        value: counts.normal,
        color: '#10B981',
      },
      {
        key: 'suspicious',
        name: 'حالات اشتباه',
        nameEn: 'Suspicious',
        value: counts.suspicious,
        color: '#3B82F6',
      },
      {
        key: 'alarm',
        name: 'حالات إنذار',
        nameEn: 'Alarm',
        value: counts.alarm,
        color: '#EF4444',
      },
    ],
    [counts]
  );

  const totalCount = counts.normal + counts.suspicious + counts.alarm;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Chart 1: Live Acoustic Waveform & Threshold Zones */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0C1322] p-4 lg:col-span-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              <span>الموجة الصوتية اللحظية ونطاقات الخطورة</span>
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Live Acoustic Emission Waveform &amp; Calibrated Threshold Zones
            </p>
          </div>

          {/* Unboxed clean legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500/70" />
              <span>إنذار ({calibration.alarmMin}–{calibration.alarmMax})</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/70" />
              <span>اشتباه ({calibration.suspiciousMin}–{calibration.suspiciousMax})</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/60" />
              <span>طبيعية ({calibration.normalMin}–{calibration.normalMax}+)</span>
            </span>
          </div>
        </div>

        <div className="h-[270px] w-full" dir="ltr">
          {waveformData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-500" dir="rtl">
              بانتظار قراءات الانبعاثات الصوتية... استخدم أزرار المحاكاة بالأعلى أو اربط الأردوينو.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={waveformData}
                margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />

                {/* Color-Coded Non-Overlapping Horizontal Threshold Bands */}
                <ReferenceArea
                  y1={calibration.alarmMin}
                  y2={calibration.alarmMax + 0.5}
                  fill="#EF4444"
                  fillOpacity={0.14}
                />
                <ReferenceArea
                  y1={calibration.suspiciousMin - 0.5}
                  y2={calibration.suspiciousMax + 0.5}
                  fill="#3B82F6"
                  fillOpacity={0.14}
                />
                <ReferenceArea
                  y1={calibration.normalMin - 0.5}
                  y2={yDomainMax}
                  fill="#10B981"
                  fillOpacity={0.1}
                />

                {/* Dashed Boundary Reference Lines */}
                <ReferenceLine
                  y={calibration.alarmMax}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  strokeOpacity={0.65}
                />
                <ReferenceLine
                  y={calibration.suspiciousMax}
                  stroke="#3B82F6"
                  strokeDasharray="4 4"
                  strokeOpacity={0.65}
                />

                <XAxis
                  dataKey="time"
                  stroke="#64748B"
                  tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  minTickGap={24}
                />
                <YAxis
                  domain={[0, yDomainMax]}
                  stroke="#64748B"
                  tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  width={38}
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const pt = payload[0].payload as ChartPoint;
                    const sev = SEVERITY_META[pt.severity];
                    return (
                      <div
                        className="rounded-lg border border-slate-700 bg-[#070B14]/95 px-3 py-2 text-xs shadow-lg"
                        dir="rtl"
                      >
                        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1">
                          <span className="font-bold" style={{ color: sev.color }}>
                            {sev.symbol} {sev.labelAr}
                          </span>
                          <span className="font-mono-num text-[11px] text-slate-400" dir="ltr">
                            {pt.time}
                          </span>
                        </div>
                        <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-300">
                          <div>
                            الحساس:{' '}
                            <span className="font-mono-num font-semibold text-cyan-300">
                              {pt.sensorId}
                            </span>
                          </div>
                          <div>
                            القراءة:{' '}
                            <span className="font-mono-num font-bold text-white">
                              {pt.reading}
                            </span>
                          </div>
                          <div>
                            عمق الشرخ:{' '}
                            <span className="font-mono-num font-semibold text-slate-100">
                              {pt.depthUm} µm
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="reading"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={<WaveformDot />}
                  activeDot={{ r: 6, stroke: '#FFFFFF', strokeWidth: 1.5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 2: Severity Distribution Donut / Bar Chart */}
      <div className="flex flex-col rounded-xl border border-slate-800/90 bg-[#0C1322] p-4 lg:col-span-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-white">
              توزيع مستويات الخطورة
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Severity Distribution Breakdown
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#080E1B] p-0.5">
            <button
              type="button"
              onClick={() => setDistChartType('donut')}
              aria-label="عرض دائري"
              className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                distChartType === 'donut'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDistChartType('bar')}
              aria-label="عرض أعمدة"
              className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                distChartType === 'bar'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="h-[190px] w-full" dir="ltr">
          {totalCount === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-500" dir="rtl">
              لا توجد قراءات مسجلة بعد
            </div>
          ) : distChartType === 'donut' ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                  stroke="#0C1322"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {distributionData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value ?? 0} قراءة`, String(name ?? '')]}
                  contentStyle={{
                    backgroundColor: '#070B14',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distributionData}
                margin={{ top: 8, right: 12, left: -12, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis
                  dataKey="nameEn"
                  stroke="#64748B"
                  tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#64748B"
                  tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                />
                <Tooltip
                  formatter={(value) => [`${value ?? 0} قراءة`, 'العدد']}
                  contentStyle={{
                    backgroundColor: '#070B14',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {distributionData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Numeric Distribution Summary Footer */}
        <div className="mt-auto grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-3">
          {distributionData.map((item) => {
            const pct = totalCount > 0 ? Math.round((item.value / totalCount) * 100) : 0;
            return (
              <div key={item.key} className="text-center">
                <div className="text-[11px] text-slate-400">{item.name}</div>
                <div
                  className="mt-0.5 font-mono-num text-sm font-bold"
                  style={{ color: item.color }}
                >
                  {item.value}{' '}
                  <span className="text-[10px] font-normal text-slate-400">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
