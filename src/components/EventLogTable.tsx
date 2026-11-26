import React, { useMemo, useState } from 'react';
import {
  Download,
  Printer,
  Trash2,
  Search,
  ClipboardList,
} from 'lucide-react';
import { AcousticEvent, SensorNode, SeverityLevel } from '../types/shm';
import { SEVERITY_META } from '../utils/shmEngine';

interface EventLogTableProps {
  events: AcousticEvent[];
  sensors: SensorNode[];
  onExportCsv: () => void;
  onPrintReport: () => void;
  onClearLog: () => void;
}

export const EventLogTable: React.FC<EventLogTableProps> = ({
  events,
  sensors,
  onExportCsv,
  onPrintReport,
  onClearLog,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'all' | SeverityLevel>('all');
  const [sensorFilter, setSensorFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEvents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return events.filter((ev) => {
      if (severityFilter !== 'all' && ev.severity !== severityFilter) return false;
      if (sensorFilter !== 'all' && ev.sensorId !== sensorFilter) return false;
      if (q) {
        const hay = `${ev.sensorId} ${ev.sensorName} ${ev.reading} ${ev.rawLine} ${SEVERITY_META[ev.severity].labelAr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, severityFilter, sensorFilter, searchTerm]);

  return (
    <section className="no-print rounded-xl border border-slate-800/90 bg-[#0C1322] p-4">
      {/* Header & Report Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div>
          <h2 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-cyan-400" />
            <span>سجل أحداث الانبعاثات الصوتية والتقارير الهندسية</span>
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Live Acoustic Event Log · Showing {filteredEvents.length} of {events.length} records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={events.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/12 px-3.5 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/22 disabled:opacity-40 whitespace-nowrap cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>تصدير CSV</span>
          </button>

          <button
            type="button"
            onClick={onPrintReport}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-[#080E1B] px-3.5 text-xs font-semibold text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-white whitespace-nowrap cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-cyan-400" />
            <span>طباعة تقرير هندسي</span>
          </button>

          <button
            type="button"
            onClick={onClearLog}
            disabled={events.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-800 bg-[#080E1B] px-3 text-xs font-medium text-slate-400 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-40 whitespace-nowrap cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>مسح السجل</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {/* Segmented Severity Filter */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#080E1B] p-1">
          {(
            [
              { key: 'all', label: 'الكل' },
              { key: 'alarm', label: 'حالة إنذار' },
              { key: 'suspicious', label: 'حالة اشتباه' },
              { key: 'normal', label: 'حالة طبيعية' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSeverityFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                severityFilter === tab.key
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sensor & Search Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sensorFilter}
            onChange={(e) => setSensorFilter(e.target.value)}
            aria-label="تصفية حسب الحساس"
            className="h-9 rounded-lg border border-slate-700 bg-[#080E1B] px-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">جميع الحساسات</option>
            {sensors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} — {s.name}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث في القراءات أو الحساسات..."
              className="h-9 w-52 rounded-lg border border-slate-700 bg-[#080E1B] pr-8 pl-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* High-Density Data Grid */}
      <div className="mt-3 max-h-[300px] overflow-auto rounded-lg border border-slate-800/80">
        <table className="w-full border-collapse text-right text-xs">
          <thead className="sticky top-0 z-10 bg-[#080E1B] text-[11px] font-semibold text-slate-400">
            <tr className="border-b border-slate-800">
              <th className="px-3.5 py-2.5">الوقت (Timestamp)</th>
              <th className="px-3.5 py-2.5">الحساس (Sensor)</th>
              <th className="px-3.5 py-2.5">القراءة الصوتية</th>
              <th className="px-3.5 py-2.5">العمق المقدر (µm)</th>
              <th className="px-3.5 py-2.5">مستوى الخطورة</th>
              <th className="hidden px-3.5 py-2.5 md:table-cell">المصدر</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">
                  لا توجد أحداث مطابقة لعوامل التصفية الحالية.
                </td>
              </tr>
            ) : (
              filteredEvents.slice(0, 120).map((ev) => {
                const sev = SEVERITY_META[ev.severity];
                return (
                  <tr
                    key={ev.id}
                    className="transition-colors hover:bg-slate-800/35"
                  >
                    <td className="font-mono-num whitespace-nowrap px-3.5 py-2.5 text-slate-300" dir="ltr">
                      {ev.timeLabel}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="font-mono-num font-semibold text-cyan-300 ml-2" dir="ltr">
                        {ev.sensorId}
                      </span>
                      <span className="text-slate-200">{ev.sensorName}</span>
                    </td>
                    <td className="font-mono-num whitespace-nowrap px-3.5 py-2.5 font-bold text-white" dir="ltr">
                      {ev.reading}
                    </td>
                    <td className="font-mono-num whitespace-nowrap px-3.5 py-2.5 text-slate-200" dir="ltr">
                      {ev.depthUm} µm
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5">
                      <span
                        className="font-semibold"
                        style={{ color: sev.color }}
                      >
                        {sev.symbol} {sev.labelAr}
                      </span>
                      <span className="mr-1.5 font-mono-num text-[10px] text-slate-500" dir="ltr">
                        {sev.labelEn}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-3.5 py-2.5 text-[11px] text-slate-400 md:table-cell">
                      {ev.source === 'arduino'
                        ? 'أردوينو (Serial)'
                        : ev.source === 'manual'
                          ? 'إدخال طرفية'
                          : 'محاكاة'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
