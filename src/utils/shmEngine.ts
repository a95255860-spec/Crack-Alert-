import {
  AcousticEvent,
  CalibrationThresholds,
  MaterialAlloy,
  ParsedSerialReading,
  SensorNode,
  SeverityLevel,
  SeverityMeta,
  SpecimenDimensions,
  SpecimenShape,
} from '../types/shm';

/**
 * Strictly calibrated to the experimental acoustic emission table:
 * - Alarm (حالة إنذار): 5 to 15 (active critical micro-crack propagation)
 * - Suspicious (حالة اشتباه): 16 to 20 (early micro-stress accumulation / 15-20 warning zone)
 * - Normal (حالة طبيعية): 21 to 50 (or baseline outside active micro-crack alert window)
 */
export const DEFAULT_CALIBRATION: CalibrationThresholds = {
  alarmMin: 5,
  alarmMax: 15,
  suspiciousMin: 16,
  suspiciousMax: 20,
  normalMin: 21,
  normalMax: 50,
};

export const SEVERITY_META: Record<SeverityLevel, SeverityMeta> = {
  normal: {
    key: 'normal',
    labelAr: 'حالة طبيعية',
    labelEn: 'Normal',
    shortAr: 'طبيعية',
    color: '#10B981',
    bgTint: 'rgba(16, 185, 129, 0.12)',
    borderTint: 'rgba(16, 185, 129, 0.35)',
    textClass: 'text-emerald-400',
    symbol: '●',
  },
  suspicious: {
    key: 'suspicious',
    labelAr: 'حالة اشتباه',
    labelEn: 'Suspicious',
    shortAr: 'اشتباه',
    color: '#3B82F6',
    bgTint: 'rgba(59, 130, 246, 0.14)',
    borderTint: 'rgba(59, 130, 246, 0.42)',
    textClass: 'text-blue-400',
    symbol: '▲',
  },
  alarm: {
    key: 'alarm',
    labelAr: 'حالة إنذار',
    labelEn: 'Alarm',
    shortAr: 'إنذار',
    color: '#EF4444',
    bgTint: 'rgba(239, 68, 68, 0.15)',
    borderTint: 'rgba(239, 68, 68, 0.48)',
    textClass: 'text-red-400',
    symbol: '✖',
  },
};

export const SPECIMEN_SHAPES: Record<
  SpecimenShape,
  {
    labelAr: string;
    labelEn: string;
    defaultDimensions: SpecimenDimensions;
    descriptionAr: string;
  }
> = {
  plate: {
    labelAr: 'صفيحة معدنية',
    labelEn: 'Metal Plate',
    defaultDimensions: { length: 300, width: 180, thickness: 12 },
    descriptionAr: 'لوح اختبار مستطيل بمثبتات طرفية',
  },
  pipe: {
    labelAr: 'أنبوب أسطواني',
    labelEn: 'Cylindrical Pipe',
    defaultDimensions: { length: 420, width: 140, thickness: 10 },
    descriptionAr: 'مقطع أنبوب ضغط عالي مع فلنجات تثبيت',
  },
  blade: {
    labelAr: 'شفرة توربين',
    labelEn: 'Turbine Blade',
    defaultDimensions: { length: 280, width: 110, thickness: 8 },
    descriptionAr: 'شفرة انسيابية ملتوية بمقعد جذري',
  },
  beam: {
    labelAr: 'عارضة معدنية',
    labelEn: 'Structural I-Beam',
    defaultDimensions: { length: 480, width: 160, thickness: 16 },
    descriptionAr: 'عارضة إنشائية مقطع I بدعامات تقوية',
  },
};

export const ALLOY_SPECS: Record<
  MaterialAlloy,
  {
    labelAr: string;
    labelEn: string;
    waveVelocityMs: number;
    baseHex: number;
    metalness: number;
    roughness: number;
    densityGcm3: number;
  }
> = {
  al7075: {
    labelAr: 'ألمنيوم طيران 7075-T6',
    labelEn: 'Al 7075-T6',
    waveVelocityMs: 6320,
    baseHex: 0x94a3b8,
    metalness: 0.88,
    roughness: 0.24,
    densityGcm3: 2.81,
  },
  ti64: {
    labelAr: 'تيتانيوم Ti-6Al-4V',
    labelEn: 'Ti-6Al-4V',
    waveVelocityMs: 6100,
    baseHex: 0x7c8798,
    metalness: 0.92,
    roughness: 0.22,
    densityGcm3: 4.43,
  },
  steelA36: {
    labelAr: 'فولاذ إنشائي A36',
    labelEn: 'Steel A36',
    waveVelocityMs: 5900,
    baseHex: 0x64748b,
    metalness: 0.85,
    roughness: 0.34,
    densityGcm3: 7.85,
  },
  inconel718: {
    labelAr: 'إنكونيل 718 (توربينات)',
    labelEn: 'Inconel 718',
    waveVelocityMs: 5820,
    baseHex: 0x8b95a5,
    metalness: 0.94,
    roughness: 0.19,
    densityGcm3: 8.19,
  },
};

/**
 * Classifies an acoustic emission peak reading strictly according to the calibrated non-overlapping thresholds:
 * - Alarm (حالة إنذار): alarmMin..alarmMax (default 5–15 inclusive)
 * - Suspicious (حالة اشتباه): suspiciousMin..suspiciousMax (default 16–20 inclusive)
 * - Normal (حالة طبيعية): > suspiciousMax (e.g. 21–50+) or baseline outside active alert window (< alarmMin)
 */
export function classifyReading(
  value: number,
  thresholds: CalibrationThresholds = DEFAULT_CALIBRATION
): SeverityLevel {
  if (value >= thresholds.alarmMin && value <= thresholds.alarmMax) {
    return 'alarm';
  }
  if (
    (value >= thresholds.suspiciousMin && value <= thresholds.suspiciousMax) ||
    (thresholds.suspiciousMin === thresholds.alarmMax + 1 &&
      value > thresholds.alarmMax &&
      value < thresholds.suspiciousMin)
  ) {
    return 'suspicious';
  }
  // Readings > 20 (21–50+) or baseline readings outside the active micro-crack alert window
  return 'normal';
}

/**
 * Estimates micro-crack depth in micrometers (µm) dynamically proportional to severity & reading:
 * - Normal: 0 – 6 µm (non-propagating baseline surface roughness)
 * - Suspicious (16–20): 15 µm – 45 µm (higher depth as value approaches 16)
 * - Alarm (5–15): 50 µm – 168 µm (deeper fracture penetration as value drops toward 5)
 */
export function estimateCrackDepthUm(
  value: number,
  severity: SeverityLevel,
  thresholds: CalibrationThresholds = DEFAULT_CALIBRATION
): number {
  if (severity === 'alarm') {
    const span = Math.max(1, thresholds.alarmMax - thresholds.alarmMin);
    const ratio = clamp((thresholds.alarmMax - value) / span, 0, 1);
    return Math.round(52 + ratio * 116); // 52 µm (at 15) -> 168 µm (at 5)
  }

  if (severity === 'suspicious') {
    const span = Math.max(1, thresholds.suspiciousMax - thresholds.suspiciousMin);
    const ratio = clamp((thresholds.suspiciousMax - value) / span, 0, 1);
    return Math.round(16 + ratio * 29); // 16 µm (at 20) -> 45 µm (at 16)
  }

  // Normal / baseline
  if (value >= thresholds.normalMin && value <= thresholds.normalMax) {
    const ratio = clamp((thresholds.normalMax - value) / Math.max(1, thresholds.normalMax - thresholds.normalMin), 0, 1);
    return Math.round(ratio * 5); // 0 to 5 µm surface baseline
  }
  return 0;
}

/**
 * Parses incoming serial lines from Arduino / Web Serial:
 * Supports:
 * 1) "Micro-Crack Peak: 14"
 * 2) Raw numeric strings "14", "28.4", "1023"
 * 3) Multi-sensor strings "S1:14,S2:25" or "S1=14; S2=18"
 */
export function parseSerialLine(rawLine: string): ParsedSerialReading[] {
  const cleaned = rawLine.trim();
  if (!cleaned) return [];

  // Multi-sensor pattern: S1:14,S2:25 or S1=14, S2=25
  const multiRegex = /\b(S\d+)\s*[:=]\s*(-?\d+(?:\.\d+)?)/gi;
  const multiMatches = Array.from(cleaned.matchAll(multiRegex));
  if (multiMatches.length > 0) {
    return multiMatches
      .map((m) => ({
        sensorToken: m[1].toUpperCase(),
        value: Number(m[2]),
      }))
      .filter((item) => Number.isFinite(item.value));
  }

  // Named peak pattern: "Micro-Crack Peak: 14" or "Peak: 14" or "AE: 18"
  const labeledMatch = cleaned.match(
    /(?:micro[- ]?crack\s*peak|peak|ae|reading|val|value)\s*[:=]\s*(-?\d+(?:\.\d+)?)/i
  );
  if (labeledMatch) {
    const num = Number(labeledMatch[1]);
    if (Number.isFinite(num)) {
      return [{ value: num }];
    }
  }

  // Raw numeric value (e.g. "14" or "32")
  const rawMatch = cleaned.match(/^-?\d+(?:\.\d+)?$/);
  if (rawMatch) {
    const num = Number(rawMatch[0]);
    if (Number.isFinite(num)) {
      return [{ value: num }];
    }
  }

  // Fallback: extract first standalone number if line has noise
  const fallbackMatch = cleaned.match(/(-?\d+(?:\.\d+)?)/);
  if (fallbackMatch) {
    const num = Number(fallbackMatch[1]);
    if (Number.isFinite(num)) {
      return [{ value: num }];
    }
  }

  return [];
}

/**
 * Computes Structural Health Index (0 - 100%) based on real sensor states & event history.
 */
export function computeStructuralHealthIndex(
  sensors: SensorNode[],
  events: AcousticEvent[]
): number {
  if (events.length === 0 && sensors.every((s) => s.lastReading === null)) {
    return 100;
  }

  const recentEvents = events.slice(0, 30);
  const alarmCount = recentEvents.filter((e) => e.severity === 'alarm').length;
  const suspiciousCount = recentEvents.filter((e) => e.severity === 'suspicious').length;

  const activeAlarmSensors = sensors.filter((s) => s.lastSeverity === 'alarm').length;
  const activeSuspiciousSensors = sensors.filter((s) => s.lastSeverity === 'suspicious').length;
  const maxDepth = Math.max(0, ...sensors.map((s) => s.estimatedDepthUm));

  const penalty =
    activeAlarmSensors * 18 +
    activeSuspiciousSensors * 7 +
    alarmCount * 2.1 +
    suspiciousCount * 0.8 +
    (maxDepth > 100 ? 8 : maxDepth > 50 ? 4 : 0);

  return Math.round(clamp(100 - penalty, 12, 100));
}

export function formatTimeArabic(timestamp: number): string {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(Math.floor(date.getMilliseconds() / 10)).padStart(2, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Deterministic pseudo-random generator for stable realistic jagged fracture paths.
 */
export function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface FractureBranch {
  points: Array<{ x: number; y: number }>;
  isPrimary: boolean;
}

/**
 * Generates realistic multi-branch jagged micro-crack geometry centered at (0,0)
 * scaled by radius. Used by both 2D SVG blueprint and 3D Three.js fracture visualizer.
 */
export function generateJaggedCrackBranches(
  seed: number,
  radius: number,
  severity: SeverityLevel
): FractureBranch[] {
  if (severity === 'normal') return [];
  const rand = seededRandom(seed);
  const branches: FractureBranch[] = [];
  const mainSegments = severity === 'alarm' ? 9 : 6;
  const branchCount = severity === 'alarm' ? 3 : 2;

  // Primary fracture axis passing near the sensor
  const baseAngle = rand() * Math.PI;
  const primaryPts: Array<{ x: number; y: number }> = [];
  for (let i = -Math.floor(mainSegments / 2); i <= Math.ceil(mainSegments / 2); i++) {
    const t = i / (mainSegments / 2);
    const along = t * radius;
    const jitter = i === 0 ? 0 : (rand() - 0.5) * radius * (severity === 'alarm' ? 0.34 : 0.22);
    const x = Math.cos(baseAngle) * along - Math.sin(baseAngle) * jitter;
    const y = Math.sin(baseAngle) * along + Math.cos(baseAngle) * jitter;
    primaryPts.push({ x, y });
  }
  branches.push({ points: primaryPts, isPrimary: true });

  // Secondary micro-fork branches
  for (let b = 0; b < branchCount; b++) {
    const anchorIdx = Math.min(
      primaryPts.length - 2,
      Math.max(1, Math.floor(rand() * (primaryPts.length - 2)) + 1)
    );
    const anchor = primaryPts[anchorIdx];
    const forkSign = b % 2 === 0 ? 1 : -1;
    const forkAngle = baseAngle + forkSign * (0.55 + rand() * 0.65);
    const forkLen = radius * (0.35 + rand() * 0.42);
    const segs = severity === 'alarm' ? 4 : 3;
    const pts: Array<{ x: number; y: number }> = [{ ...anchor }];
    for (let s = 1; s <= segs; s++) {
      const f = s / segs;
      const lateral = (rand() - 0.5) * forkLen * 0.28;
      pts.push({
        x: anchor.x + Math.cos(forkAngle) * forkLen * f - Math.sin(forkAngle) * lateral,
        y: anchor.y + Math.sin(forkAngle) * forkLen * f + Math.cos(forkAngle) * lateral,
      });
    }
    branches.push({ points: pts, isPrimary: false });
  }

  return branches;
}

export function createInitialSensors(dims: SpecimenDimensions): SensorNode[] {
  const presets = [
    { id: 'S1', name: 'حساس بيزو S1 (المركز)', nx: 0.36, ny: 0.44, seed: 4127 },
    { id: 'S2', name: 'حساس بيزو S2 (الإجهاد)', nx: 0.68, ny: 0.56, seed: 8391 },
    { id: 'S3', name: 'حساس بيزو S3 (الطرف)', nx: 0.22, ny: 0.72, seed: 1923 },
  ];
  return presets.map((p) => ({
    id: p.id,
    name: p.name,
    nx: p.nx,
    ny: p.ny,
    xMm: Math.round(p.nx * dims.length),
    yMm: Math.round(p.ny * dims.width),
    zMm: dims.thickness,
    lastReading: null,
    lastSeverity: 'normal',
    estimatedDepthUm: 0,
    crackSeed: p.seed,
    lastUpdated: null,
  }));
}

export function generateSimulatedValue(
  targetSeverity: SeverityLevel,
  thresholds: CalibrationThresholds = DEFAULT_CALIBRATION
): number {
  if (targetSeverity === 'alarm') {
    const min = thresholds.alarmMin;
    const max = thresholds.alarmMax;
    // Experimental alarm samples include 5, 7, 9, 11, 12, 15
    return Math.round(min + Math.random() * Math.max(1, max - min));
  }
  if (targetSeverity === 'suspicious') {
    const min = thresholds.suspiciousMin;
    const max = thresholds.suspiciousMax;
    // Experimental suspicious samples: 16, 17, 18, 19, 20
    return Math.round(min + Math.random() * Math.max(1, max - min));
  }
  // Normal experimental samples: 21..50
  const min = thresholds.normalMin;
  const max = thresholds.normalMax;
  return Math.round(min + Math.random() * Math.max(1, max - min));
}
