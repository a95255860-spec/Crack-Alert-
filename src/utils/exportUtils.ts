import { AcousticEvent, SpecimenConfig } from '../types/shm';
import { SEVERITY_META, SPECIMEN_SHAPES, ALLOY_SPECS } from './shmEngine';

export function exportEventsToCsv(events: AcousticEvent[], specimen: SpecimenConfig): void {
  const headers = [
    'Event ID',
    'الوقت (Timestamp)',
    'رمز الحساس (Sensor ID)',
    'اسم الحساس (Sensor Name)',
    'القراءة الصوتية (AE Peak)',
    'عمق الشرخ المقدر (µm)',
    'التصنيف العربي (Severity AR)',
    'Severity EN',
    'المصدر (Source)',
    'السطر الخام (Raw Data)',
  ];

  const rows = events.map((ev) => {
    const meta = SEVERITY_META[ev.severity];
    return [
      ev.id,
      new Date(ev.timestamp).toISOString(),
      ev.sensorId,
      ev.sensorName,
      ev.reading,
      ev.depthUm,
      meta.labelAr,
      meta.labelEn,
      ev.source,
      ev.rawLine,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',');
  });

  const metaHeader = [
    `"Crack Alert AI — Structural Health Monitoring Export"`,
    `"Specimen: ${SPECIMEN_SHAPES[specimen.shape].labelEn} (${specimen.specimenCode}) | Alloy: ${ALLOY_SPECS[specimen.alloy].labelEn} | Dimensions: ${specimen.dimensions.length}x${specimen.dimensions.width}x${specimen.dimensions.thickness} mm"`,
    '',
  ];

  const csvContent = '\uFEFF' + [...metaHeader, headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateSlug = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  link.href = url;
  link.download = `crack-alert-ai-shm-log-${dateSlug}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
