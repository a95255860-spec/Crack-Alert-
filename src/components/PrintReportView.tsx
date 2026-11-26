import React from 'react';
import {
  AcousticEvent,
  CalibrationThresholds,
  SensorNode,
  SpecimenConfig,
} from '../types/shm';
import { ALLOY_SPECS, SEVERITY_META, SPECIMEN_SHAPES } from '../utils/shmEngine';

interface PrintReportViewProps {
  specimen: SpecimenConfig;
  sensors: SensorNode[];
  events: AcousticEvent[];
  counts: { normal: number; suspicious: number; alarm: number };
  healthIndex: number;
  calibration: CalibrationThresholds;
}

export const PrintReportView: React.FC<PrintReportViewProps> = ({
  specimen,
  sensors,
  events,
  counts,
  healthIndex,
  calibration,
}) => {
  const shapeInfo = SPECIMEN_SHAPES[specimen.shape];
  const alloyInfo = ALLOY_SPECS[specimen.alloy];
  const maxDepth = Math.max(0, ...sensors.map((s) => s.estimatedDepthUm));

  return (
    <div className="print-only bg-white p-6 text-slate-900" dir="rtl">
      <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-950">
            Crack Alert AI — التقرير الهندسي لمراقبة السلامة الإنشائية
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Structural Health Monitoring (SHM) &amp; Acoustic Emission Diagnostic Report
          </p>
        </div>
        <div className="text-left font-mono-num text-xs text-slate-700" dir="ltr">
          <div>Date: {new Date().toLocaleString('en-GB')}</div>
          <div>Specimen ID: {specimen.specimenCode}</div>
        </div>
      </div>

      {/* Specimen & Calibration Summary */}
      <div className="mt-5 grid grid-cols-3 gap-4 text-xs">
        <div className="rounded border border-slate-300 p-3">
          <div className="font-bold text-slate-700">مواصفات العينة الهندسية</div>
          <div className="mt-1.5 space-y-1">
            <div>النموذج: {shapeInfo.labelAr} ({shapeInfo.labelEn})</div>
            <div>السبيكة: {alloyInfo.labelAr}</div>
            <div>
              الأبعاد: {specimen.dimensions.length} × {specimen.dimensions.width} ×{' '}
              {specimen.dimensions.thickness} mm
            </div>
          </div>
        </div>

        <div className="rounded border border-slate-300 p-3">
          <div className="font-bold text-slate-700">ملخص السلامة الإنشائية</div>
          <div className="mt-1.5 space-y-1">
            <div>مؤشر سلامة الهيكل: {healthIndex}%</div>
            <div>أقصى عمق شرخ مقدر: {maxDepth} µm</div>
            <div>
              الأحداث: {counts.normal} طبيعية · {counts.suspicious} اشتباه · {counts.alarm} إنذار
            </div>
          </div>
        </div>

        <div className="rounded border border-slate-300 p-3">
          <div className="font-bold text-slate-700">نطاقات المعايرة المعتمدة</div>
          <div className="mt-1.5 space-y-1 font-mono-num" dir="ltr">
            <div>Alarm (إنذار): {calibration.alarmMin} – {calibration.alarmMax}</div>
            <div>Suspicious (اشتباه): {calibration.suspiciousMin} – {calibration.suspiciousMax}</div>
            <div>Normal (طبيعية): {calibration.normalMin} – {calibration.normalMax}</div>
          </div>
        </div>
      </div>

      {/* Sensors Inventory */}
      <h2 className="mt-6 font-display text-sm font-bold text-slate-900">
        1. خريطة حساسات البيزو المثبتة (Piezoelectric Sensor Array)
      </h2>
      <table className="mt-2 w-full border-collapse border border-slate-300 text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-2.5 py-1.5 text-right">الرمز</th>
            <th className="border border-slate-300 px-2.5 py-1.5 text-right">اسم الحساس</th>
            <th className="border border-slate-300 px-2.5 py-1.5 text-right">الإحداثيات (X,Y,Z mm)</th>
            <th className="border border-slate-300 px-2.5 py-1.5 text-right">آخر قراءة</th>
            <th className="border border-slate-300 px-2.5 py-1.5 text-right">العمق (µm)</th>
            <th className="border border-slate-300 px-2.5 py-1.5 text-right">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {sensors.map((s) => (
            <tr key={s.id}>
              <td className="border border-slate-300 px-2.5 py-1.5 font-mono-num">{s.id}</td>
              <td className="border border-slate-300 px-2.5 py-1.5">{s.name}</td>
              <td className="border border-slate-300 px-2.5 py-1.5 font-mono-num" dir="ltr">
                ({s.xMm}, {s.yMm}, {s.zMm})
              </td>
              <td className="border border-slate-300 px-2.5 py-1.5 font-mono-num">
                {s.lastReading ?? '--'}
              </td>
              <td className="border border-slate-300 px-2.5 py-1.5 font-mono-num">
                {s.estimatedDepthUm} µm
              </td>
              <td className="border border-slate-300 px-2.5 py-1.5 font-semibold">
                {SEVERITY_META[s.lastSeverity].labelAr}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Recent Events Table */}
      <h2 className="mt-6 font-display text-sm font-bold text-slate-900">
        2. سجل القراءات والأحداث المسجلة (أحدث 40 قراءة)
      </h2>
      <table className="mt-2 w-full border-collapse border border-slate-300 text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-2.5 py-1.5 text-right">الوقت</th>
            <th className="border border-slate-300 px-2.5 py-1.5 text-right">الحساس</th>
            <th className="border border-slate-300 px-2.5 py-1.5 text-right">القراءة</th>
            <th className="border border-slate-300 px-2.5 py-1.5 text-right">عمق الشرخ (µm)</th>
            <th className="border border-slate-300 px-2.5 py-1.5 text-right">مستوى الخطورة</th>
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 40).map((ev) => (
            <tr key={ev.id}>
              <td className="border border-slate-300 px-2.5 py-1 font-mono-num" dir="ltr">
                {ev.timeLabel}
              </td>
              <td className="border border-slate-300 px-2.5 py-1">
                {ev.sensorId} — {ev.sensorName}
              </td>
              <td className="border border-slate-300 px-2.5 py-1 font-mono-num">{ev.reading}</td>
              <td className="border border-slate-300 px-2.5 py-1 font-mono-num">{ev.depthUm} µm</td>
              <td className="border border-slate-300 px-2.5 py-1 font-semibold">
                {SEVERITY_META[ev.severity].labelAr} ({SEVERITY_META[ev.severity].labelEn})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
