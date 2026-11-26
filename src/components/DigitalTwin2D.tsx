import React, { useRef, useState } from 'react';
import { PlusCircle, Move } from 'lucide-react';
import { SensorNode, SpecimenConfig } from '../types/shm';
import {
  SEVERITY_META,
  clamp,
  generateJaggedCrackBranches,
} from '../utils/shmEngine';

interface DigitalTwin2DProps {
  specimen: SpecimenConfig;
  sensors: SensorNode[];
  selectedSensorId: string;
  onSelectSensor: (id: string) => void;
  onMoveSensor: (id: string, nx: number, ny: number) => void;
  onAddSensorAt: (nx: number, ny: number) => void;
}

export const DigitalTwin2D: React.FC<DigitalTwin2DProps> = ({
  specimen,
  sensors,
  selectedSensorId,
  onSelectSensor,
  onMoveSensor,
  onAddSensorAt,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [hoverMm, setHoverMm] = useState<{ x: number; y: number } | null>(null);

  // Blueprint internal specimen box within SVG viewBox 800 x 500
  const boxX = 110;
  const boxY = 82;
  const boxW = 580;
  const boxH = 326;

  const clientToNormalized = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * 800;
    const svgY = ((clientY - rect.top) / rect.height) * 500;
    const nx = clamp((svgX - boxX) / boxW, 0.04, 0.96);
    const ny = clamp((svgY - boxY) / boxH, 0.06, 0.94);
    return { nx, ny, inside: svgX >= boxX && svgX <= boxX + boxW && svgY >= boxY && svgY <= boxY + boxH };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const res = clientToNormalized(e.clientX, e.clientY);
    if (!res) return;
    if (res.inside) {
      setHoverMm({
        x: Math.round(res.nx * specimen.dimensions.length),
        y: Math.round(res.ny * specimen.dimensions.width),
      });
    } else {
      setHoverMm(null);
    }
    if (draggingId) {
      onMoveSensor(draggingId, res.nx, res.ny);
    }
  };

  const handlePointerUp = () => {
    if (draggingId) setDraggingId(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!addMode || draggingId) return;
    const res = clientToNormalized(e.clientX, e.clientY);
    if (res && res.inside) {
      onAddSensorAt(res.nx, res.ny);
    }
  };

  const renderBlueprintGeometry = () => {
    if (specimen.shape === 'pipe') {
      return (
        <g>
          {/* Main pipe cylinder body */}
          <rect
            x={boxX + 26}
            y={boxY + 26}
            width={boxW - 52}
            height={boxH - 52}
            rx="4"
            fill="url(#bpSurfaceGrad)"
            stroke="#38BDF8"
            strokeWidth="1.6"
          />
          {/* End pressure flanges */}
          <rect
            x={boxX}
            y={boxY + 8}
            width="26"
            height={boxH - 16}
            rx="3"
            fill="#111C30"
            stroke="#64748B"
            strokeWidth="1.5"
          />
          <rect
            x={boxX + boxW - 26}
            y={boxY + 8}
            width="26"
            height={boxH - 16}
            rx="3"
            fill="#111C30"
            stroke="#64748B"
            strokeWidth="1.5"
          />
          {/* Longitudinal pipe centerline & curvature shading lines */}
          <line
            x1={boxX}
            y1={boxY + boxH / 2}
            x2={boxX + boxW}
            y2={boxY + boxH / 2}
            stroke="#06B6D4"
            strokeWidth="1"
            strokeDasharray="10 5 2 5"
            opacity="0.55"
          />
          <line
            x1={boxX + 26}
            y1={boxY + 62}
            x2={boxX + boxW - 26}
            y2={boxY + 62}
            stroke="rgba(148,163,184,0.2)"
            strokeWidth="1"
          />
          <line
            x1={boxX + 26}
            y1={boxY + boxH - 62}
            x2={boxX + boxW - 26}
            y2={boxY + boxH - 62}
            stroke="rgba(148,163,184,0.2)"
            strokeWidth="1"
          />
        </g>
      );
    }

    if (specimen.shape === 'blade') {
      return (
        <g>
          {/* Dovetail turbine root */}
          <rect
            x={boxX}
            y={boxY + 60}
            width="54"
            height={boxH - 120}
            rx="4"
            fill="#111C30"
            stroke="#64748B"
            strokeWidth="1.5"
          />
          {/* Tapered airfoil planform */}
          <path
            d={`M ${boxX + 54} ${boxY + 34}
                Q ${boxX + boxW * 0.55} ${boxY + 12}, ${boxX + boxW - 18} ${boxY + 62}
                Q ${boxX + boxW} ${boxY + boxH * 0.5}, ${boxX + boxW - 18} ${boxY + boxH - 68}
                Q ${boxX + boxW * 0.55} ${boxY + boxH - 22}, ${boxX + 54} ${boxY + boxH - 34} Z`}
            fill="url(#bpSurfaceGrad)"
            stroke="#38BDF8"
            strokeWidth="1.6"
          />
          {/* Camber contour lines */}
          <path
            d={`M ${boxX + 66} ${boxY + boxH * 0.44} Q ${boxX + boxW * 0.54} ${boxY + boxH * 0.36}, ${boxX + boxW - 28} ${boxY + boxH * 0.48}`}
            fill="none"
            stroke="#06B6D4"
            strokeDasharray="6 4"
            opacity="0.45"
          />
        </g>
      );
    }

    if (specimen.shape === 'beam') {
      return (
        <g>
          {/* Top Flange Plan View */}
          <rect
            x={boxX}
            y={boxY + 18}
            width={boxW}
            height={boxH - 36}
            rx="3"
            fill="url(#bpSurfaceGrad)"
            stroke="#38BDF8"
            strokeWidth="1.6"
          />
          {/* Hidden central web dashed boundaries */}
          <line
            x1={boxX}
            y1={boxY + boxH / 2 - 22}
            x2={boxX + boxW}
            y2={boxY + boxH / 2 - 22}
            stroke="#06B6D4"
            strokeDasharray="6 4"
            opacity="0.5"
          />
          <line
            x1={boxX}
            y1={boxY + boxH / 2 + 22}
            x2={boxX + boxW}
            y2={boxY + boxH / 2 + 22}
            stroke="#06B6D4"
            strokeDasharray="6 4"
            opacity="0.5"
          />
          {/* Stiffener rib lines */}
          {[0.2, 0.5, 0.8].map((f) => (
            <line
              key={f}
              x1={boxX + boxW * f}
              y1={boxY + 18}
              x2={boxX + boxW * f}
              y2={boxY + boxH - 18}
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="2"
            />
          ))}
        </g>
      );
    }

    // Rectangular Metal Plate
    return (
      <g>
        <rect
          x={boxX}
          y={boxY}
          width={boxW}
          height={boxH}
          rx="6"
          fill="url(#bpSurfaceGrad)"
          stroke="#38BDF8"
          strokeWidth="1.6"
        />
        {/* Side clamp strips */}
        <rect
          x={boxX}
          y={boxY}
          width="24"
          height={boxH}
          fill="#111C30"
          opacity="0.7"
        />
        <rect
          x={boxX + boxW - 24}
          y={boxY}
          width="24"
          height={boxH}
          fill="#111C30"
          opacity="0.7"
        />
        {/* Corner rivets */}
        {[
          [boxX + 12, boxY + 24],
          [boxX + 12, boxY + boxH / 2],
          [boxX + 12, boxY + boxH - 24],
          [boxX + boxW - 12, boxY + 24],
          [boxX + boxW - 12, boxY + boxH / 2],
          [boxX + boxW - 12, boxY + boxH - 24],
        ].map(([cx, cy], idx) => (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r="4.5"
            fill="#0B1324"
            stroke="#64748B"
            strokeWidth="1.2"
          />
        ))}
      </g>
    );
  };

  return (
    <div className="relative h-[470px] w-full overflow-hidden rounded-xl border border-slate-800/90 bg-[#060A13] sm:h-[520px]">
      {/* Top Blueprint Toolbar */}
      <div className="absolute top-3 right-3 left-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-slate-700/80 bg-[#070B14]/95 px-3 py-1.5 text-[11px] text-slate-300">
          <span className="font-mono-num text-cyan-400" dir="ltr">
            2D CAD BLUEPRINT
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="font-mono-num" dir="ltr">
            {hoverMm
              ? `X: ${hoverMm.x} mm · Y: ${hoverMm.y} mm`
              : `${specimen.dimensions.length} × ${specimen.dimensions.width} mm`}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              addMode
                ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                : 'border-slate-700 bg-[#0B1221] text-slate-200 hover:border-cyan-500/50'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>{addMode ? 'انقر على المخطط لوضع الحساس' : 'إضافة حساس على المخطط'}</span>
          </button>
          <span className="hidden items-center gap-1 rounded-md border border-slate-800 bg-[#0B1221] px-2.5 py-1.5 text-[11px] text-slate-400 sm:inline-flex">
            <Move className="h-3 w-3 text-cyan-400" />
            <span>اسحب أي حساس لتعديل موقعه</span>
          </span>
        </div>
      </div>

      {/* Interactive CAD Blueprint SVG */}
      <svg
        ref={svgRef}
        viewBox="0 0 800 500"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleCanvasClick}
        className={`h-full w-full select-none ${addMode ? 'cursor-crosshair' : 'cursor-default'}`}
      >
        <defs>
          <pattern id="cadSubGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="rgba(56, 189, 248, 0.06)"
              strokeWidth="0.7"
            />
          </pattern>
          <pattern id="cadMainGrid" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#cadSubGrid)" />
            <path
              d="M 100 0 L 0 0 0 100"
              fill="none"
              stroke="rgba(56, 189, 248, 0.13)"
              strokeWidth="1"
            />
          </pattern>
          <linearGradient id="bpSurfaceGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#142033" />
            <stop offset="100%" stopColor="#0C1423" />
          </linearGradient>
          <clipPath id="specimenClip">
            <rect x={boxX} y={boxY} width={boxW} height={boxH} rx="6" />
          </clipPath>
        </defs>

        {/* Engineering grid backdrop */}
        <rect x="0" y="0" width="800" height="500" fill="url(#cadMainGrid)" />

        {/* Specimen CAD silhouette */}
        {renderBlueprintGeometry()}

        {/* Uploaded Specimen Blueprint / Real Photo Overlay */}
        {specimen.customImageUrl && (
          <image
            href={specimen.customImageUrl}
            x={boxX}
            y={boxY}
            width={boxW}
            height={boxH}
            preserveAspectRatio="xMidYMid slice"
            opacity={specimen.customImageOpacity}
            clipPath="url(#specimenClip)"
          />
        )}

        {/* Dimension Callout Lines (Length mm & Width mm) */}
        <g stroke="#475569" strokeWidth="1" fill="#94A3B8" fontFamily="JetBrains Mono, monospace" fontSize="11">
          {/* Bottom Length Dimension */}
          <line x1={boxX} y1={boxY + boxH + 28} x2={boxX + boxW} y2={boxY + boxH + 28} />
          <line x1={boxX} y1={boxY + boxH + 20} x2={boxX} y2={boxY + boxH + 36} />
          <line x1={boxX + boxW} y1={boxY + boxH + 20} x2={boxX + boxW} y2={boxY + boxH + 36} />
          <rect x={boxX + boxW / 2 - 58} y={boxY + boxH + 19} width="116" height="18" fill="#060A13" stroke="none" />
          <text x={boxX + boxW / 2} y={boxY + boxH + 32} textAnchor="middle" stroke="none">
            L = {specimen.dimensions.length} mm
          </text>

          {/* Left Width Dimension */}
          <line x1={boxX - 28} y1={boxY} x2={boxX - 28} y2={boxY + boxH} />
          <line x1={boxX - 36} y1={boxY} x2={boxX - 20} y2={boxY} />
          <line x1={boxX - 36} y1={boxY + boxH} x2={boxX - 20} y2={boxY + boxH} />
          <text
            x={boxX - 40}
            y={boxY + boxH / 2}
            textAnchor="middle"
            stroke="none"
            transform={`rotate(-90 ${boxX - 40} ${boxY + boxH / 2})`}
          >
            W = {specimen.dimensions.width} mm
          </text>
        </g>

        {/* Sensors + Real-time Micro-Crack Fracture Overlay + Expanding Ripples */}
        {sensors.map((sensor) => {
          const sx = boxX + sensor.nx * boxW;
          const sy = boxY + sensor.ny * boxH;
          const sevMeta = SEVERITY_META[sensor.lastSeverity];
          const isSelected = sensor.id === selectedSensorId;
          const crackRadius = sensor.lastSeverity === 'alarm' ? 54 : 34;
          const branches = generateJaggedCrackBranches(
            sensor.crackSeed,
            crackRadius,
            sensor.lastSeverity
          );

          return (
            <g key={sensor.id}>
              {/* Expanding Acoustic Emission Wavefront Rings */}
              {sensor.lastSeverity !== 'normal' && (
                <g>
                  <circle
                    cx={sx}
                    cy={sy}
                    r="22"
                    fill="none"
                    stroke={sevMeta.color}
                    strokeWidth={sensor.lastSeverity === 'alarm' ? '2.2' : '1.6'}
                    className="ae-ripple-ring"
                  />
                  <circle
                    cx={sx}
                    cy={sy}
                    r="22"
                    fill="none"
                    stroke={sevMeta.color}
                    strokeWidth="1.4"
                    className="ae-ripple-ring-delay"
                  />
                </g>
              )}

              {/* Jagged Micro-Crack Branching Fracture Lines */}
              {branches.map((branch, bIdx) => {
                const d = branch.points
                  .map(
                    (pt, pIdx) =>
                      `${pIdx === 0 ? 'M' : 'L'} ${(sx + pt.x).toFixed(1)} ${(sy + pt.y).toFixed(1)}`
                  )
                  .join(' ');
                return (
                  <g key={bIdx}>
                    {/* Outer subtle glow stroke */}
                    <path
                      d={d}
                      fill="none"
                      stroke={sevMeta.color}
                      strokeWidth={branch.isPrimary ? 5 : 3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.28"
                    />
                    {/* Crisp fracture core */}
                    <path
                      d={d}
                      fill="none"
                      stroke={sevMeta.color}
                      strokeWidth={branch.isPrimary ? 2.1 : 1.3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })}

              {/* Interactive Draggable Piezoelectric Sensor Node */}
              <g
                transform={`translate(${sx}, ${sy})`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectSensor(sensor.id);
                  setDraggingId(sensor.id);
                }}
                className="cursor-grab active:cursor-grabbing"
              >
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    r="21"
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                )}
                {/* Piezo housing */}
                <circle
                  r="14"
                  fill="#0B1324"
                  stroke={sevMeta.color}
                  strokeWidth="2.2"
                />
                <circle r="7" fill={sevMeta.color} opacity="0.25" />
                <circle r="3.5" fill={sevMeta.color} />

                {/* Clean Coordinate & Value Callout */}
                <g transform="translate(0, -24)">
                  <rect
                    x="-46"
                    y="-14"
                    width="92"
                    height="20"
                    rx="4"
                    fill="#070B14"
                    stroke={isSelected ? '#06B6D4' : '#334155'}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="-1"
                    textAnchor="middle"
                    fill="#F1F5F9"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {sensor.id}: {sensor.lastReading !== null ? sensor.lastReading : '--'}
                    {sensor.estimatedDepthUm > 0 ? ` · ${sensor.estimatedDepthUm}µm` : ''}
                  </text>
                </g>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
