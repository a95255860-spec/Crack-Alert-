import React, { useMemo } from 'react';
import { Microscope, Layers } from 'lucide-react';
import { SensorNode, SpecimenConfig } from '../types/shm';
import { ALLOY_SPECS, SEVERITY_META, seededRandom } from '../utils/shmEngine';

interface CrackDepthInspectorProps {
  sensor: SensorNode | undefined;
  specimen: SpecimenConfig;
}

export const CrackDepthInspector: React.FC<CrackDepthInspectorProps> = ({
  sensor,
  specimen,
}) => {
  const depthUm = sensor?.estimatedDepthUm ?? 0;
  const severity = sensor?.lastSeverity ?? 'normal';
  const sevMeta = SEVERITY_META[severity];
  const alloy = ALLOY_SPECS[specimen.alloy];

  const maxDisplayUm = 200;
  const clampedDepth = Math.min(maxDisplayUm, Math.max(0, depthUm));
  const surfaceY = 44;
  const wallBottomY = 212;
  const usableHeight = wallBottomY - surfaceY;
  const tipY = surfaceY + (clampedDepth / maxDisplayUm) * usableHeight;

  // Deterministic jagged V-notch cross-section profile
  const { crackPath, subBranchPath } = useMemo(() => {
    if (clampedDepth <= 2) {
      return { crackPath: '', subBranchPath: '' };
    }
    const rand = seededRandom((sensor?.crackSeed ?? 77) + Math.round(clampedDepth));
    const cx = 180;
    const halfMouth = severity === 'alarm' ? 9.5 : severity === 'suspicious' ? 5.5 : 2.5;
    const steps = 8;

    const leftPts: Array<[number, number]> = [[cx - halfMouth, surfaceY]];
    const rightPts: Array<[number, number]> = [[cx + halfMouth, surfaceY]];
    let curX = cx;

    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const y = surfaceY + (tipY - surfaceY) * f;
      const drift = (rand() - 0.5) * (severity === 'alarm' ? 14 : 7) * (1 - f * 0.3);
      curX = cx + drift;
      const halfW = halfMouth * Math.pow(1 - f, 1.35);
      leftPts.push([curX - halfW, y]);
      rightPts.push([curX + halfW, y]);
    }

    const polygonPts = [...leftPts, ...rightPts.reverse()];
    const mainD =
      polygonPts
        .map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
        .join(' ') + ' Z';

    // Secondary microscopic root fissure for alarm / suspicious
    let branchD = '';
    if (severity !== 'normal' && clampedDepth >= 20) {
      const midIdx = Math.floor(steps * 0.62);
      const [bx, by] = leftPts[midIdx] ?? [cx, surfaceY + 30];
      const dir = rand() > 0.5 ? 1 : -1;
      const b1x = bx + dir * 16;
      const b1y = by + 12;
      const b2x = b1x + dir * (severity === 'alarm' ? 18 : 10);
      const b2y = Math.min(wallBottomY - 6, b1y + (severity === 'alarm' ? 18 : 9));
      branchD = `M ${bx.toFixed(1)} ${by.toFixed(1)} L ${b1x.toFixed(1)} ${b1y.toFixed(1)} L ${b2x.toFixed(1)} ${b2y.toFixed(1)}`;
    }

    return { crackPath: mainD, subBranchPath: branchD };
  }, [clampedDepth, severity, sensor?.crackSeed, tipY]);

  const thicknessUm = Math.max(1000, specimen.dimensions.thickness * 1000);
  const wallPenetrationPct = ((depthUm / thicknessUm) * 100).toFixed(2);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800/90 bg-[#0C1322] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <Microscope className="h-4 w-4 text-cyan-400" />
            <span>عارض عمق الشرخ المايكرومتري</span>
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            مقطع عرضي لاختراق الشرخ داخل سماكة المادة (Cross-Section µm)
          </p>
        </div>
        <div className="text-left" dir="ltr">
          <div
            className="font-mono-num text-xl font-bold leading-none"
            style={{ color: sevMeta.color }}
          >
            {depthUm} µm
          </div>
          <div className="mt-1 font-mono-num text-[10px] text-slate-400">
            {sevMeta.symbol} {sevMeta.labelEn}
          </div>
        </div>
      </div>

      {/* Microscopic Cross-Section SVG Visualizer */}
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-[#070C17]">
        <svg
          viewBox="0 0 360 236"
          className="h-[220px] w-full"
          role="img"
          aria-label={`مقطع عرضي لعمق الشرخ ${depthUm} ميكرومتر`}
        >
          <defs>
            <linearGradient id="metalWallGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#263348" />
              <stop offset="18%" stopColor="#1B2538" />
              <stop offset="100%" stopColor="#101829" />
            </linearGradient>
            <pattern
              id="alloyGrain"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 0 16 L 16 0 M -4 4 L 4 -4 M 12 20 L 20 12"
                stroke="rgba(148,163,184,0.06)"
                strokeWidth="1"
              />
            </pattern>
            <radialGradient id="crackGlow" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor={sevMeta.color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={sevMeta.color} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Air / Space above specimen */}
          <rect x="0" y="0" width="360" height={surfaceY} fill="#060A13" />

          {/* Piezo sensor sitting on top surface */}
          <rect
            x="148"
            y="24"
            width="64"
            height="14"
            rx="2"
            fill="#1E293B"
            stroke="#06B6D4"
            strokeWidth="1.2"
          />
          <rect x="164" y="16" width="32" height="8" rx="1.5" fill="#334155" />
          <line x1="180" y1="6" x2="180" y2="16" stroke="#06B6D4" strokeWidth="1.5" />
          <text
            x="180"
            y="34"
            textAnchor="middle"
            fill="#E2E8F0"
            fontSize="8.5"
            fontFamily="JetBrains Mono, monospace"
          >
            {sensor?.id ?? 'S1'} PIEZO
          </text>

          {/* Specimen Alloy Wall Body */}
          <rect
            x="48"
            y={surfaceY}
            width="264"
            height={usableHeight}
            fill="url(#metalWallGrad)"
          />
          <rect
            x="48"
            y={surfaceY}
            width="264"
            height={usableHeight}
            fill="url(#alloyGrain)"
          />

          {/* Calibrated Severity Depth Zones along right edge */}
          {/* Safe zone 0-15 µm */}
          <rect
            x="312"
            y={surfaceY}
            width="6"
            height={(15 / maxDisplayUm) * usableHeight}
            fill="#10B981"
            opacity="0.7"
          />
          {/* Suspicious zone 15-45 µm */}
          <rect
            x="312"
            y={surfaceY + (15 / maxDisplayUm) * usableHeight}
            width="6"
            height={(35 / maxDisplayUm) * usableHeight}
            fill="#3B82F6"
            opacity="0.8"
          />
          {/* Critical Alarm zone 50-200 µm */}
          <rect
            x="312"
            y={surfaceY + (50 / maxDisplayUm) * usableHeight}
            width="6"
            height={(150 / maxDisplayUm) * usableHeight}
            fill="#EF4444"
            opacity="0.85"
          />

          {/* Top machined surface highlight line */}
          <line
            x1="48"
            y1={surfaceY}
            x2="312"
            y2={surfaceY}
            stroke="#38BDF8"
            strokeWidth="1.5"
            opacity="0.7"
          />

          {/* Depth horizontal reference grid lines */}
          {[0, 25, 50, 100, 150, 200].map((um) => {
            const y = surfaceY + (um / maxDisplayUm) * usableHeight;
            return (
              <g key={um}>
                <line
                  x1="48"
                  y1={y}
                  x2="312"
                  y2={y}
                  stroke={um === 50 ? 'rgba(239,68,68,0.32)' : 'rgba(148,163,184,0.12)'}
                  strokeDasharray={um === 0 || um === 200 ? undefined : '3 3'}
                />
                <text
                  x="42"
                  y={y + 3}
                  textAnchor="end"
                  fill={um === 50 ? '#F87171' : '#64748B'}
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {um}
                </text>
              </g>
            );
          })}

          {/* Axis unit label */}
          <text
            x="14"
            y="132"
            textAnchor="middle"
            fill="#64748B"
            fontSize="9"
            fontFamily="JetBrains Mono, monospace"
            transform="rotate(-90 14 132)"
          >
            DEPTH (µm)
          </text>

          {/* Stress field glow around crack tip */}
          {clampedDepth > 4 && (
            <circle cx="180" cy={tipY} r={severity === 'alarm' ? 42 : 26} fill="url(#crackGlow)" />
          )}

          {/* Jagged penetrating V-notch micro-crack */}
          {crackPath && (
            <path
              d={crackPath}
              fill="#05080F"
              stroke={sevMeta.color}
              strokeWidth={severity === 'alarm' ? '1.8' : '1.3'}
              strokeLinejoin="round"
            />
          )}
          {subBranchPath && (
            <path
              d={subBranchPath}
              fill="none"
              stroke={sevMeta.color}
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.9"
            />
          )}

          {/* Live Depth Measurement Callout Line */}
          {clampedDepth > 2 && (
            <g>
              <line
                x1="180"
                y1={tipY}
                x2="306"
                y2={tipY}
                stroke={sevMeta.color}
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle cx="180" cy={tipY} r="3" fill={sevMeta.color} />
              <rect
                x="236"
                y={Math.min(wallBottomY - 22, Math.max(surfaceY + 4, tipY - 10))}
                width="68"
                height="18"
                rx="3"
                fill="#070B14"
                stroke={sevMeta.color}
                strokeWidth="1"
              />
              <text
                x="270"
                y={Math.min(wallBottomY - 10, Math.max(surfaceY + 16, tipY + 2))}
                textAnchor="middle"
                fill={sevMeta.color}
                fontSize="9.5"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                {depthUm} µm
              </text>
            </g>
          )}

          {/* Bottom wall edge */}
          <line
            x1="48"
            y1={wallBottomY}
            x2="312"
            y2={wallBottomY}
            stroke="#334155"
            strokeWidth="1.5"
          />
          <text
            x="180"
            y="228"
            textAnchor="middle"
            fill="#64748B"
            fontSize="9"
            fontFamily="JetBrains Mono, monospace"
          >
            WALL THICKNESS: {specimen.dimensions.thickness} mm ({thicknessUm.toLocaleString()} µm) · PENETRATION {wallPenetrationPct}%
          </text>
        </svg>
      </div>

      {/* Physical Telemetry Footer */}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-3 text-xs">
        <div>
          <div className="text-[11px] text-slate-400">إحداثيات الحساس</div>
          <div className="mt-0.5 font-mono-num text-[11px] font-semibold text-slate-200" dir="ltr">
            {sensor ? `(${sensor.xMm}, ${sensor.yMm}, ${sensor.zMm})` : '--'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">سرعة الموجة الصوتية</div>
          <div className="mt-0.5 font-mono-num text-[11px] font-semibold text-cyan-300" dir="ltr">
            {alloy.waveVelocityMs} m/s
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Layers className="h-3 w-3 text-slate-500" />
            <span>السبيكة</span>
          </div>
          <div className="mt-0.5 font-mono-num text-[11px] font-semibold text-slate-200" dir="ltr">
            {alloy.labelEn}
          </div>
        </div>
      </div>
    </div>
  );
};
