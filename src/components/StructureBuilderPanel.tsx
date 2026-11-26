import React, { useState } from 'react';
import {
  Box,
  Cpu,
  Upload,
  Trash2,
  Plus,
  Crosshair,
  ImageOff,
} from 'lucide-react';
import {
  MaterialAlloy,
  SensorNode,
  SpecimenConfig,
  SpecimenShape,
} from '../types/shm';
import {
  ALLOY_SPECS,
  SEVERITY_META,
  SPECIMEN_SHAPES,
  clamp,
} from '../utils/shmEngine';

interface StructureBuilderPanelProps {
  specimen: SpecimenConfig;
  onUpdateSpecimen: (next: SpecimenConfig) => void;
  sensors: SensorNode[];
  selectedSensorId: string;
  onSelectSensor: (id: string) => void;
  onAddSensor: () => void;
  onUpdateSensor: (id: string, patch: Partial<SensorNode>) => void;
  onDeleteSensor: (id: string) => void;
}

export const StructureBuilderPanel: React.FC<StructureBuilderPanelProps> = ({
  specimen,
  onUpdateSpecimen,
  sensors,
  selectedSensorId,
  onSelectSensor,
  onAddSensor,
  onUpdateSensor,
  onDeleteSensor,
}) => {
  const [activeTab, setActiveTab] = useState<'structure' | 'sensors'>('structure');
  const selectedSensor = sensors.find((s) => s.id === selectedSensorId) ?? sensors[0];

  const handleShapeSelect = (shape: SpecimenShape) => {
    onUpdateSpecimen({
      ...specimen,
      shape,
      dimensions: { ...SPECIMEN_SHAPES[shape].defaultDimensions },
    });
  };

  const handleDimensionChange = (key: 'length' | 'width' | 'thickness', raw: string) => {
    const val = Number(raw);
    if (!Number.isFinite(val)) return;
    const bounded =
      key === 'thickness' ? clamp(val, 2, 80) : clamp(val, 40, 2000);
    onUpdateSpecimen({
      ...specimen,
      dimensions: {
        ...specimen.dimensions,
        [key]: bounded,
      },
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateSpecimen({
          ...specimen,
          customImageUrl: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800/90 bg-[#0C1322]">
      {/* Segmented Control Header */}
      <div className="flex border-b border-slate-800/90 p-1.5 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('structure')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'structure'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Box className="h-3.5 w-3.5" />
          <span>باني الهيكل الافتراضي</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sensors')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'sensors'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>الحساسات ({sensors.length})</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'structure' ? (
          <>
            {/* Specimen Shape Presets */}
            <div>
              <div className="mb-2 text-xs font-semibold text-slate-300">
                نموذج العينة الهندسية (Specimen Preset)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SPECIMEN_SHAPES) as SpecimenShape[]).map((key) => {
                  const info = SPECIMEN_SHAPES[key];
                  const active = specimen.shape === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleShapeSelect(key)}
                      className={`rounded-lg border p-2.5 text-right transition-colors cursor-pointer ${
                        active
                          ? 'border-cyan-400/70 bg-cyan-500/14 text-white'
                          : 'border-slate-800 bg-[#080E1B] text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{info.labelAr}</div>
                      <div className="mt-0.5 font-mono-num text-[10px] text-slate-400" dir="ltr">
                        {info.labelEn}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Dimensions (Length x Width x Thickness in mm) */}
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>الأبعاد الفيزيائية (mm)</span>
                <span className="font-mono-num text-[10px] text-slate-500" dir="ltr">
                  L × W × T
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">الطول L</label>
                  <input
                    type="number"
                    min={40}
                    max={2000}
                    value={specimen.dimensions.length}
                    onChange={(e) => handleDimensionChange('length', e.target.value)}
                    className="font-mono-num w-full rounded-md border border-slate-700 bg-[#080E1B] px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">العرض W</label>
                  <input
                    type="number"
                    min={40}
                    max={2000}
                    value={specimen.dimensions.width}
                    onChange={(e) => handleDimensionChange('width', e.target.value)}
                    className="font-mono-num w-full rounded-md border border-slate-700 bg-[#080E1B] px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">السماكة T</label>
                  <input
                    type="number"
                    min={2}
                    max={80}
                    value={specimen.dimensions.thickness}
                    onChange={(e) => handleDimensionChange('thickness', e.target.value)}
                    className="font-mono-num w-full rounded-md border border-slate-700 bg-[#080E1B] px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* Alloy Material Selector */}
            <div>
              <label
                htmlFor="alloy-select"
                className="mb-1.5 block text-xs font-semibold text-slate-300"
              >
                المادة الإنشائية (Material Alloy)
              </label>
              <select
                id="alloy-select"
                value={specimen.alloy}
                onChange={(e) =>
                  onUpdateSpecimen({
                    ...specimen,
                    alloy: e.target.value as MaterialAlloy,
                  })
                }
                className="w-full rounded-md border border-slate-700 bg-[#080E1B] px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                {(Object.keys(ALLOY_SPECS) as MaterialAlloy[]).map((a) => (
                  <option key={a} value={a}>
                    {ALLOY_SPECS[a].labelAr} ({ALLOY_SPECS[a].waveVelocityMs} m/s)
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Specimen Image / Blueprint */}
            <div className="border-t border-slate-800/80 pt-3.5">
              <div className="mb-2 text-xs font-semibold text-slate-300">
                صورة أو مخطط العينة الحقيقية (Blueprint Upload)
              </div>
              <div className="flex items-center gap-2">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-[#080E1B] px-3 py-2.5 text-xs font-medium text-cyan-300 transition-colors hover:border-cyan-500/60 hover:bg-cyan-500/5">
                  <Upload className="h-3.5 w-3.5" />
                  <span>رفع صورة / مخطط العينة</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                {specimen.customImageUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSpecimen({ ...specimen, customImageUrl: null })
                    }
                    title="إزالة الصورة"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/35 bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer"
                  >
                    <ImageOff className="h-4 w-4" />
                  </button>
                )}
              </div>

              {specimen.customImageUrl && (
                <div className="mt-2.5">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>شفافية المخطط المرفوع</span>
                    <span className="font-mono-num" dir="ltr">
                      {Math.round(specimen.customImageOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.15}
                    max={1}
                    step={0.05}
                    value={specimen.customImageOpacity}
                    onChange={(e) =>
                      onUpdateSpecimen({
                        ...specimen,
                        customImageOpacity: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          /* Sensors Management Tab */
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                حساسات البيزو المثبتة
              </span>
              <button
                type="button"
                onClick={onAddSensor}
                className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة حساس</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-[175px] overflow-y-auto pl-1">
              {sensors.map((sensor) => {
                const active = sensor.id === selectedSensorId;
                const sev = SEVERITY_META[sensor.lastSeverity];
                return (
                  <div
                    key={sensor.id}
                    onClick={() => onSelectSensor(sensor.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors cursor-pointer ${
                      active
                        ? 'border-cyan-500/60 bg-cyan-500/10'
                        : 'border-slate-800 bg-[#080E1B] hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono-num text-[11px] font-bold"
                          style={{ color: sev.color }}
                          dir="ltr"
                        >
                          {sensor.id}
                        </span>
                        <span className="truncate font-medium text-slate-200">
                          {sensor.name}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono-num text-[10px] text-slate-400" dir="ltr">
                        ({sensor.xMm}, {sensor.yMm}, {sensor.zMm}) mm ·{' '}
                        {sensor.lastReading !== null ? `Peak ${sensor.lastReading}` : 'Standby'}
                      </div>
                    </div>

                    {sensors.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSensor(sensor.id);
                        }}
                        aria-label={`حذف ${sensor.name}`}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected Sensor Precision Editor */}
            {selectedSensor && (
              <div className="space-y-3 border-t border-slate-800/80 pt-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                  <Crosshair className="h-3.5 w-3.5" />
                  <span>تعديل إحداثيات وتسمية {selectedSensor.id}</span>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    اسم الحساس
                  </label>
                  <input
                    type="text"
                    value={selectedSensor.name}
                    onChange={(e) =>
                      onUpdateSensor(selectedSensor.id, { name: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-700 bg-[#080E1B] px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400" dir="ltr">
                      X (mm)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={specimen.dimensions.length}
                      value={selectedSensor.xMm}
                      onChange={(e) => {
                        const xMm = clamp(Number(e.target.value) || 0, 0, specimen.dimensions.length);
                        onUpdateSensor(selectedSensor.id, {
                          xMm,
                          nx: clamp(xMm / Math.max(1, specimen.dimensions.length), 0.04, 0.96),
                        });
                      }}
                      className="font-mono-num w-full rounded-md border border-slate-700 bg-[#080E1B] px-2 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400" dir="ltr">
                      Y (mm)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={specimen.dimensions.width}
                      value={selectedSensor.yMm}
                      onChange={(e) => {
                        const yMm = clamp(Number(e.target.value) || 0, 0, specimen.dimensions.width);
                        onUpdateSensor(selectedSensor.id, {
                          yMm,
                          ny: clamp(yMm / Math.max(1, specimen.dimensions.width), 0.06, 0.94),
                        });
                      }}
                      className="font-mono-num w-full rounded-md border border-slate-700 bg-[#080E1B] px-2 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400" dir="ltr">
                      Z (mm)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={specimen.dimensions.thickness}
                      value={selectedSensor.zMm}
                      onChange={(e) => {
                        const zMm = clamp(Number(e.target.value) || 0, 0, specimen.dimensions.thickness);
                        onUpdateSensor(selectedSensor.id, { zMm });
                      }}
                      className="font-mono-num w-full rounded-md border border-slate-700 bg-[#080E1B] px-2 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
