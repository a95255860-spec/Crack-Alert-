export type SeverityLevel = 'normal' | 'suspicious' | 'alarm';

export type ConnectionMode = 'disconnected' | 'connected' | 'simulation';

export type SpecimenShape = 'plate' | 'pipe' | 'blade' | 'beam';

export type MaterialAlloy = 'al7075' | 'ti64' | 'steelA36' | 'inconel718';

export interface CalibrationThresholds {
  alarmMin: number;
  alarmMax: number;
  suspiciousMin: number;
  suspiciousMax: number;
  normalMin: number;
  normalMax: number;
}

export interface SpecimenDimensions {
  length: number; // mm (X axis)
  width: number; // mm (Z/Y axis)
  thickness: number; // mm (wall/depth thickness)
}

export interface SpecimenConfig {
  shape: SpecimenShape;
  alloy: MaterialAlloy;
  dimensions: SpecimenDimensions;
  customImageUrl: string | null;
  customImageOpacity: number;
  specimenCode: string;
}

export interface SensorNode {
  id: string; // e.g., "S1", "S2"
  name: string; // e.g., "حساس بيزو 1"
  /** Normalized coordinates on specimen surface [0..1] for 2D/3D mapping */
  nx: number;
  ny: number;
  /** Physical coordinates in mm derived from dimensions */
  xMm: number;
  yMm: number;
  zMm: number;
  lastReading: number | null;
  lastSeverity: SeverityLevel;
  estimatedDepthUm: number;
  crackSeed: number;
  lastUpdated: number | null;
}

export interface AcousticEvent {
  id: string;
  timestamp: number;
  timeLabel: string;
  sensorId: string;
  sensorName: string;
  reading: number;
  depthUm: number;
  severity: SeverityLevel;
  source: 'arduino' | 'simulation' | 'manual';
  rawLine: string;
}

export interface SerialConsoleEntry {
  id: string;
  timestamp: string;
  direction: 'rx' | 'tx' | 'sys';
  text: string;
  severity?: SeverityLevel;
}

export interface ParsedSerialReading {
  sensorToken?: string; // e.g. "S1"
  value: number;
}

export interface SeverityMeta {
  key: SeverityLevel;
  labelAr: string;
  labelEn: string;
  shortAr: string;
  color: string;
  bgTint: string;
  borderTint: string;
  textClass: string;
  symbol: string;
}
