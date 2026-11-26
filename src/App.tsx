import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Box, Grid2x2 } from 'lucide-react';
import {
  AcousticEvent,
  CalibrationThresholds,
  ConnectionMode,
  SensorNode,
  SerialConsoleEntry,
  SeverityLevel,
  SpecimenConfig,
} from './types/shm';
import {
  DEFAULT_CALIBRATION,
  SPECIMEN_SHAPES,
  classifyReading,
  computeStructuralHealthIndex,
  createInitialSensors,
  estimateCrackDepthUm,
  formatTimeArabic,
  generateSimulatedValue,
  parseSerialLine,
} from './utils/shmEngine';
import { acousticAudio } from './utils/audioEngine';
import { exportEventsToCsv } from './utils/exportUtils';
import { useWebSerial } from './hooks/useWebSerial';
import { Header } from './components/Header';
import { SimulationToolbar } from './components/SimulationToolbar';
import { KpiStrip } from './components/KpiStrip';
import { DigitalTwin3D } from './components/DigitalTwin3D';
import { DigitalTwin2D } from './components/DigitalTwin2D';
import { CrackDepthInspector } from './components/CrackDepthInspector';
import { StructureBuilderPanel } from './components/StructureBuilderPanel';
import { TelemetryCharts } from './components/TelemetryCharts';
import { EventLogTable } from './components/EventLogTable';
import { SerialDrawer } from './components/SerialDrawer';
import { CalibrationModal } from './components/CalibrationModal';
import { PrintReportView } from './components/PrintReportView';

const INITIAL_SPECIMEN: SpecimenConfig = {
  shape: 'plate',
  alloy: 'al7075',
  dimensions: { ...SPECIMEN_SHAPES.plate.defaultDimensions },
  customImageUrl: null,
  customImageOpacity: 0.72,
  specimenCode: 'AE-PLATE-7075-01',
};

/**
 * Generates an initial calibrated baseline sequence matching the experimental table
 * so charts, 3D fracture depth inspector, and log are immediately populated on first load.
 */
function createInitialTelemetry(
  initialSensors: SensorNode[],
  calibration: CalibrationThresholds
): {
  sensors: SensorNode[];
  events: AcousticEvent[];
  consoleEntries: SerialConsoleEntry[];
} {
  const now = Date.now();
  const seedReadings: Array<{ sensorId: string; value: number; offsetMs: number }> = [
    { sensorId: 'S3', value: 42, offsetMs: -11000 },
    { sensorId: 'S1', value: 35, offsetMs: -9500 },
    { sensorId: 'S2', value: 28, offsetMs: -8000 },
    { sensorId: 'S1', value: 25, offsetMs: -6500 },
    { sensorId: 'S2', value: 19, offsetMs: -5000 },
    { sensorId: 'S2', value: 17, offsetMs: -3500 },
    { sensorId: 'S1', value: 12, offsetMs: -1800 },
  ];

  const sensorMap = new Map(initialSensors.map((s) => [s.id, { ...s }]));
  const events: AcousticEvent[] = [];
  const consoleEntries: SerialConsoleEntry[] = [];

  seedReadings.forEach((item, idx) => {
    const ts = now + item.offsetMs;
    const sensor = sensorMap.get(item.sensorId) ?? initialSensors[0];
    const severity = classifyReading(item.value, calibration);
    const depthUm = estimateCrackDepthUm(item.value, severity, calibration);
    const rawLine = `Micro-Crack Peak: ${item.value} (${sensor.id})`;

    sensor.lastReading = item.value;
    sensor.lastSeverity = severity;
    sensor.estimatedDepthUm = depthUm;
    sensor.lastUpdated = ts;

    events.unshift({
      id: `EV-INIT-${idx + 1}`,
      timestamp: ts,
      timeLabel: formatTimeArabic(ts),
      sensorId: sensor.id,
      sensorName: sensor.name,
      reading: item.value,
      depthUm,
      severity,
      source: 'simulation',
      rawLine,
    });

    consoleEntries.unshift({
      id: `CON-INIT-${idx + 1}`,
      timestamp: formatTimeArabic(ts).slice(0, 8),
      direction: 'rx',
      text: rawLine,
      severity,
    });
  });

  consoleEntries.push({
    id: 'CON-SYS-BOOT',
    timestamp: formatTimeArabic(now - 12000).slice(0, 8),
    direction: 'sys',
    text: 'Crack Alert AI SHM Engine initialized · Calibration: Alarm [5-15], Suspicious [16-20], Normal [21-50].',
  });

  return {
    sensors: Array.from(sensorMap.values()),
    events,
    consoleEntries,
  };
}

export default function App() {
  const [calibration, setCalibration] = useState<CalibrationThresholds>(DEFAULT_CALIBRATION);
  const [specimen, setSpecimen] = useState<SpecimenConfig>(INITIAL_SPECIMEN);

  const initialBundle = useMemo(() => {
    const baseSensors = createInitialSensors(INITIAL_SPECIMEN.dimensions);
    return createInitialTelemetry(baseSensors, DEFAULT_CALIBRATION);
  }, []);

  const [sensors, setSensors] = useState<SensorNode[]>(initialBundle.sensors);
  const [selectedSensorId, setSelectedSensorId] = useState<string>('S1');
  const [events, setEvents] = useState<AcousticEvent[]>(initialBundle.events);
  const [consoleEntries, setConsoleEntries] = useState<SerialConsoleEntry[]>(
    initialBundle.consoleEntries
  );

  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [baudRate, setBaudRate] = useState<115200 | 9600>(115200);
  const [simulationActive, setSimulationActive] = useState<boolean>(true);
  const [autoStream, setAutoStream] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [serialDrawerOpen, setSerialDrawerOpen] = useState<boolean>(false);
  const [calibrationModalOpen, setCalibrationModalOpen] = useState<boolean>(false);

  // Refs to keep Web Serial callback fresh without re-binding serial reader
  const sensorsRef = useRef(sensors);
  const selectedSensorIdRef = useRef(selectedSensorId);
  const calibrationRef = useRef(calibration);
  const audioEnabledRef = useRef(audioEnabled);

  sensorsRef.current = sensors;
  selectedSensorIdRef.current = selectedSensorId;
  calibrationRef.current = calibration;
  audioEnabledRef.current = audioEnabled;

  const appendConsole = useCallback(
    (direction: 'rx' | 'tx' | 'sys', text: string, severity?: SeverityLevel) => {
      const entry: SerialConsoleEntry = {
        id: `C-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: formatTimeArabic(Date.now()).slice(0, 8),
        direction,
        text,
        severity,
      };
      setConsoleEntries((prev) => [entry, ...prev].slice(0, 180));
    },
    []
  );

  /**
   * Core Acoustic Emission Ingestion Pipeline:
   * Handles parsed readings from Web Serial Arduino, Simulation Mode, or Manual Console.
   */
  const ingestReading = useCallback(
    (
      value: number,
      source: 'arduino' | 'simulation' | 'manual',
      rawLine: string,
      explicitSensorId?: string
    ) => {
      const now = Date.now();
      const cal = calibrationRef.current;
      const currentSensors = sensorsRef.current;
      const targetId = explicitSensorId ?? selectedSensorIdRef.current;
      const targetSensor =
        currentSensors.find((s) => s.id.toUpperCase() === targetId.toUpperCase()) ??
        currentSensors[0];

      if (!targetSensor) return;

      const severity = classifyReading(value, cal);
      const depthUm = estimateCrackDepthUm(value, severity, cal);

      acousticAudio.playAlert(severity, audioEnabledRef.current);

      setSensors((prev) =>
        prev.map((s) =>
          s.id === targetSensor.id
            ? {
                ...s,
                lastReading: value,
                lastSeverity: severity,
                estimatedDepthUm: depthUm,
                lastUpdated: now,
              }
            : s
        )
      );

      const newEvent: AcousticEvent = {
        id: `EV-${now}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        timeLabel: formatTimeArabic(now),
        sensorId: targetSensor.id,
        sensorName: targetSensor.name,
        reading: value,
        depthUm,
        severity,
        source,
        rawLine,
      };

      setEvents((prev) => [newEvent, ...prev].slice(0, 300));
      appendConsole('rx', rawLine, severity);
    },
    [appendConsole]
  );

  // Incoming Web Serial line handler
  const handleSerialLine = useCallback(
    (line: string) => {
      const parsed = parseSerialLine(line);
      if (parsed.length === 0) {
        appendConsole('rx', line);
        return;
      }
      parsed.forEach((p) => {
        ingestReading(p.value, 'arduino', line, p.sensorToken);
      });
    },
    [ingestReading, appendConsole]
  );

  const webSerial = useWebSerial({
    baudRate,
    onLine: handleSerialLine,
    onSystemMessage: (msg) => appendConsole('sys', msg),
  });

  const connectionMode: ConnectionMode = webSerial.isConnected
    ? 'connected'
    : simulationActive
      ? 'simulation'
      : 'disconnected';

  // Continuous Simulation Auto-Stream loop
  useEffect(() => {
    if (!autoStream || webSerial.isConnected) return;
    const timer = window.setInterval(() => {
      const list = sensorsRef.current;
      if (list.length === 0) return;
      const picked = list[Math.floor(Math.random() * list.length)];
      const roll = Math.random();
      const targetSev: SeverityLevel =
        roll < 0.22 ? 'alarm' : roll < 0.48 ? 'suspicious' : 'normal';
      const val = generateSimulatedValue(targetSev, calibrationRef.current);
      setSelectedSensorId(picked.id);
      ingestReading(val, 'simulation', `${picked.id}:${val}`, picked.id);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [autoStream, webSerial.isConnected, ingestReading]);

  // Quick manual simulation trigger
  const handleTriggerSample = useCallback(
    (severity: SeverityLevel) => {
      if (!webSerial.isConnected) {
        setSimulationActive(true);
      }
      const val = generateSimulatedValue(severity, calibrationRef.current);
      const activeId = selectedSensorIdRef.current;
      ingestReading(val, 'simulation', `Micro-Crack Peak: ${val}`, activeId);
    },
    [webSerial.isConnected, ingestReading]
  );

  // Manual packet injector inside Serial Console Drawer
  const handleInjectManualLine = useCallback(
    (line: string) => {
      appendConsole('tx', line);
      if (webSerial.isConnected) {
        void webSerial.sendCommand(line);
      }
      const parsed = parseSerialLine(line);
      if (parsed.length > 0) {
        parsed.forEach((p) => {
          ingestReading(p.value, 'manual', line, p.sensorToken);
        });
      }
    },
    [appendConsole, webSerial, ingestReading]
  );

  // Sync sensor physical mm coordinates whenever specimen dimensions change
  const handleUpdateSpecimen = useCallback((next: SpecimenConfig) => {
    setSpecimen(next);
    setSensors((prev) =>
      prev.map((s) => ({
        ...s,
        xMm: Math.round(s.nx * next.dimensions.length),
        yMm: Math.round(s.ny * next.dimensions.width),
        zMm: Math.min(s.zMm, next.dimensions.thickness),
      }))
    );
  }, []);

  // Add sensor at normalized (nx, ny)
  const handleAddSensorAt = useCallback(
    (nx: number, ny: number) => {
      setSensors((prev) => {
        const nextNum =
          prev.reduce((max, s) => {
            const m = s.id.match(/^S(\d+)$/);
            return m ? Math.max(max, Number(m[1])) : max;
          }, 0) + 1;
        const id = `S${nextNum}`;
        const newSensor: SensorNode = {
          id,
          name: `حساس بيزو ${id}`,
          nx,
          ny,
          xMm: Math.round(nx * specimen.dimensions.length),
          yMm: Math.round(ny * specimen.dimensions.width),
          zMm: specimen.dimensions.thickness,
          lastReading: null,
          lastSeverity: 'normal',
          estimatedDepthUm: 0,
          crackSeed: Math.floor(1000 + Math.random() * 8999),
          lastUpdated: null,
        };
        setSelectedSensorId(id);
        return [...prev, newSensor];
      });
    },
    [specimen.dimensions]
  );

  const handleMoveSensor = useCallback(
    (id: string, nx: number, ny: number) => {
      setSensors((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                nx,
                ny,
                xMm: Math.round(nx * specimen.dimensions.length),
                yMm: Math.round(ny * specimen.dimensions.width),
              }
            : s
        )
      );
    },
    [specimen.dimensions]
  );

  const handleUpdateSensor = useCallback((id: string, patch: Partial<SensorNode>) => {
    setSensors((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const handleDeleteSensor = useCallback((id: string) => {
    setSensors((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((s) => s.id !== id);
      if (selectedSensorIdRef.current === id && filtered[0]) {
        setSelectedSensorId(filtered[0].id);
      }
      return filtered;
    });
  }, []);

  // Re-classify existing sensor readings when calibration thresholds are updated
  const handleCalibrationChange = useCallback((nextCal: CalibrationThresholds) => {
    setCalibration(nextCal);
    setSensors((prev) =>
      prev.map((s) => {
        if (s.lastReading === null) return s;
        const sev = classifyReading(s.lastReading, nextCal);
        const depth = estimateCrackDepthUm(s.lastReading, sev, nextCal);
        return { ...s, lastSeverity: sev, estimatedDepthUm: depth };
      })
    );
  }, []);

  // Derived Telemetry Metrics
  const counts = useMemo(() => {
    let normal = 0;
    let suspicious = 0;
    let alarm = 0;
    for (const ev of events) {
      if (ev.severity === 'alarm') alarm++;
      else if (ev.severity === 'suspicious') suspicious++;
      else normal++;
    }
    return { normal, suspicious, alarm };
  }, [events]);

  const activeSensor = useMemo(
    () => sensors.find((s) => s.id === selectedSensorId) ?? sensors[0],
    [sensors, selectedSensorId]
  );

  const latestEvent = events[0];
  const latestReading = activeSensor?.lastReading ?? latestEvent?.reading ?? null;
  const latestSeverity: SeverityLevel =
    activeSensor?.lastSeverity ?? latestEvent?.severity ?? 'normal';

  const healthIndex = useMemo(
    () => computeStructuralHealthIndex(sensors, events),
    [sensors, events]
  );

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 pb-16">
      {/* Screen-only Aerospace SHM Dashboard */}
      <div className="no-print">
        <Header
          connectionMode={connectionMode}
          isConnecting={webSerial.isConnecting}
          baudRate={baudRate}
          onChangeBaudRate={(nextBaud) => {
            setBaudRate(nextBaud);
            appendConsole(
              'sys',
              `تم ضبط سرعة المنفذ التسلسلي على ${nextBaud} baud (${nextBaud === 9600 ? 'HC-05/HC-06 Bluetooth' : 'USB Cable'}).`
            );
          }}
          audioEnabled={audioEnabled}
          activeSeverity={latestSeverity}
          onConnectArduino={async () => {
            const ok = await webSerial.connect();
            if (ok) {
              setSimulationActive(false);
              setAutoStream(false);
            }
          }}
          onDisconnectArduino={() => void webSerial.disconnect()}
          onToggleSimulation={() => {
            if (webSerial.isConnected) {
              void webSerial.disconnect();
            }
            setSimulationActive((prev) => {
              const next = !prev;
              if (!next) setAutoStream(false);
              return next;
            });
          }}
          onToggleAudio={() => setAudioEnabled((v) => !v)}
          onOpenCalibration={() => setCalibrationModalOpen(true)}
        />

        <SimulationToolbar
          connectionMode={connectionMode}
          autoStream={autoStream}
          onToggleAutoStream={() => {
            if (!webSerial.isConnected) setSimulationActive(true);
            setAutoStream((v) => !v);
          }}
          onTriggerSample={handleTriggerSample}
          sensors={sensors}
          selectedSensorId={selectedSensorId}
          onSelectSensor={setSelectedSensorId}
          calibration={calibration}
          serialError={webSerial.errorMessage}
          onClearSerialError={webSerial.clearError}
          onEnableSimulation={() => setSimulationActive(true)}
        />

        <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 lg:px-6">
          {/* 1. Real-Time Aerospace KPI Telemetry Strip */}
          <KpiStrip
            latestReading={latestReading}
            latestSeverity={latestSeverity}
            activeSensor={activeSensor}
            counts={counts}
            healthIndex={healthIndex}
            dimensions={specimen.dimensions}
            calibration={calibration}
          />

          {/* 2. Primary Workspace: Interactive 2D/3D Digital Twin + Structure Builder + Crack Depth Cross-Section */}
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* Center Dominant Anchor: Digital Twin Viewport (7 cols) */}
            <div className="flex flex-col space-y-2.5 xl:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-white">
                    التوأم الرقمي للهيكل وكاشف الشروخ الدقيقة
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Interactive 2D / 3D Structural Health Digital Twin · {SPECIMEN_SHAPES[specimen.shape].labelAr}
                  </p>
                </div>

                {/* Seamless 2D / 3D View Switcher */}
                <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0C1322] p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('3d')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      viewMode === '3d'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Box className="h-3.5 w-3.5" />
                    <span>عرض ثلاثي الأبعاد 3D</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('2d')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      viewMode === '2d'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Grid2x2 className="h-3.5 w-3.5" />
                    <span>عرض ثنائي الأبعاد 2D</span>
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {viewMode === '3d' ? (
                  <motion.div
                    key="view-3d"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <DigitalTwin3D
                      specimen={specimen}
                      sensors={sensors}
                      selectedSensorId={selectedSensorId}
                      onSelectSensor={setSelectedSensorId}
                      onAddSensorAt={handleAddSensorAt}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="view-2d"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <DigitalTwin2D
                      specimen={specimen}
                      sensors={sensors}
                      selectedSensorId={selectedSensorId}
                      onSelectSensor={setSelectedSensorId}
                      onMoveSensor={handleMoveSensor}
                      onAddSensorAt={handleAddSensorAt}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Side Analytical Column: Cross-Sectional Depth Inspector & Structure Builder (5 cols) */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-5 xl:grid-cols-1">
              <CrackDepthInspector sensor={activeSensor} specimen={specimen} />

              <StructureBuilderPanel
                specimen={specimen}
                onUpdateSpecimen={handleUpdateSpecimen}
                sensors={sensors}
                selectedSensorId={selectedSensorId}
                onSelectSensor={setSelectedSensorId}
                onAddSensor={() =>
                  handleAddSensorAt(
                    Number((0.2 + Math.random() * 0.6).toFixed(2)),
                    Number((0.2 + Math.random() * 0.6).toFixed(2))
                  )
                }
                onUpdateSensor={handleUpdateSensor}
                onDeleteSensor={handleDeleteSensor}
              />
            </div>
          </section>

          {/* 3. Live Acoustic Waveform & Severity Distribution Charts */}
          <TelemetryCharts
            events={events}
            calibration={calibration}
            counts={counts}
          />

          {/* 4. Filterable Event Log & CSV / Engineering Report Export */}
          <EventLogTable
            events={events}
            sensors={sensors}
            onExportCsv={() => exportEventsToCsv(events, specimen)}
            onPrintReport={() => window.print()}
            onClearLog={() => {
              setEvents([]);
              setSensors((prev) =>
                prev.map((s) => ({
                  ...s,
                  lastReading: null,
                  lastSeverity: 'normal',
                  estimatedDepthUm: 0,
                  lastUpdated: null,
                }))
              );
            }}
          />
        </main>

        {/* Collapsible Bottom Serial Console & Quick Calibration Drawer */}
        <SerialDrawer
          isOpen={serialDrawerOpen}
          onToggleOpen={() => setSerialDrawerOpen((v) => !v)}
          baudRate={baudRate}
          entries={consoleEntries}
          onClearConsole={() => setConsoleEntries([])}
          onInjectManualLine={handleInjectManualLine}
          calibration={calibration}
          onChangeCalibration={handleCalibrationChange}
        />

        {/* Full Calibration Settings Modal */}
        <CalibrationModal
          isOpen={calibrationModalOpen}
          calibration={calibration}
          onClose={() => setCalibrationModalOpen(false)}
          onSave={handleCalibrationChange}
        />
      </div>

      {/* Print-Only Engineering Diagnostic Report */}
      <PrintReportView
        specimen={specimen}
        sensors={sensors}
        events={events}
        counts={counts}
        healthIndex={healthIndex}
        calibration={calibration}
      />
    </div>
  );
}
