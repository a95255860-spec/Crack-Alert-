import React from 'react';
import {
  Sliders,
  Volume2,
  VolumeX,
  Usb,
  Unplug,
  Activity,
  Radio,
} from 'lucide-react';
import { ConnectionMode, SeverityLevel } from '../types/shm';

interface HeaderProps {
  connectionMode: ConnectionMode;
  isConnecting: boolean;
  baudRate: 115200 | 9600;
  onChangeBaudRate: (baud: 115200 | 9600) => void;
  audioEnabled: boolean;
  activeSeverity: SeverityLevel;
  onConnectArduino: () => void;
  onDisconnectArduino: () => void;
  onToggleSimulation: () => void;
  onToggleAudio: () => void;
  onOpenCalibration: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionMode,
  isConnecting,
  baudRate,
  onChangeBaudRate,
  audioEnabled,
  activeSeverity,
  onConnectArduino,
  onDisconnectArduino,
  onToggleSimulation,
  onToggleAudio,
  onOpenCalibration,
}) => {
  const statusMeta =
    connectionMode === 'connected'
      ? {
          ar: 'متصل بالأردوينو',
          en: `Connected · ${baudRate} baud (${baudRate === 9600 ? 'BT HC-05/06' : 'USB'})`,
          color: '#10B981',
          textClass: 'text-emerald-400',
        }
      : connectionMode === 'simulation'
        ? {
            ar: 'وضع المحاكاة',
            en: 'Simulation Mode',
            color: '#06B6D4',
            textClass: 'text-cyan-400',
          }
        : {
            ar: 'غير متصل',
            en: 'Disconnected',
            color: '#64748B',
            textClass: 'text-slate-400',
          };

  const brandGlow =
    activeSeverity === 'alarm'
      ? 'drop-shadow-[0_0_16px_rgba(239,68,68,0.48)]'
      : activeSeverity === 'suspicious'
        ? 'drop-shadow-[0_0_14px_rgba(59,130,246,0.42)]'
        : 'drop-shadow-[0_0_14px_rgba(6,182,212,0.38)]';

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-800/80 bg-[#070B14]/95">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3 lg:px-6">
        {/* Zone 1: Geometric Acoustic-Wave & Structural-Shield Brand Lockup */}
        <div className="flex items-center gap-3.5 shrink-0">
          <div className={`relative flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-500/30 bg-[#0C1425] ${brandGlow}`}>
            <svg
              viewBox="0 0 44 44"
              className="h-8 w-8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Outer aerospace structural shield hexagon */}
              <path
                d="M22 3L37 10.5V23.5C37 32 30.6 38.4 22 41C13.4 38.4 7 32 7 23.5V10.5L22 3Z"
                stroke="#06B6D4"
                strokeWidth="1.6"
                fill="rgba(6, 182, 212, 0.08)"
              />
              {/* Inner precision frame */}
              <path
                d="M22 7.2L33.2 12.8V23C33.2 29.4 28.4 34.4 22 36.6C15.6 34.4 10.8 29.4 10.8 23V12.8L22 7.2Z"
                stroke="rgba(148, 163, 184, 0.25)"
                strokeWidth="1"
              />
              {/* Calibrated acoustic emission wave pulse */}
              <path
                d="M11.5 22.5H15.5L18 16.5L21 29.5L24.5 13.5L27.2 24.8L29.5 22.5H32.5"
                stroke={
                  activeSeverity === 'alarm'
                    ? '#EF4444'
                    : activeSeverity === 'suspicious'
                      ? '#3B82F6'
                      : '#10B981'
                }
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="flex flex-col">
            <div className="flex items-baseline gap-2.5">
              <h1 className="font-display text-xl font-extrabold tracking-tight text-white whitespace-nowrap sm:text-2xl">
                <span className="bg-gradient-to-l from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
                  Crack Alert AI
                </span>
              </h1>
              <span className="hidden text-xs font-medium text-slate-400 sm:inline whitespace-nowrap">
                مراقبة السلامة الإنشائية والانبعاثات الصوتية
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: statusMeta.color }}
                aria-hidden="true"
              />
              <span className={`font-semibold whitespace-nowrap ${statusMeta.textClass}`}>
                {statusMeta.ar}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-mono-num text-[11px] text-slate-400 whitespace-nowrap" dir="ltr">
                {statusMeta.en}
              </span>
            </div>
          </div>
        </div>

        {/* Zone 2: Controls & Primary Hardware Action */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Audio Alarm Toggle */}
          <button
            type="button"
            onClick={onToggleAudio}
            title={audioEnabled ? 'كتم صوت الإنذار' : 'تفعيل صوت الإنذار'}
            className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              audioEnabled
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
                : 'border-slate-700/80 bg-[#0D1424] text-slate-400 hover:border-slate-600 hover:text-slate-200'
            }`}
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden xl:inline">{audioEnabled ? 'الإنذار الصوتي مفعل' : 'الصوت مكتوم'}</span>
          </button>

          {/* Calibration Modal Trigger */}
          <button
            type="button"
            onClick={onOpenCalibration}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-700/80 bg-[#0D1424] px-3 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sliders className="h-4 w-4 text-cyan-400" />
            <span>المعايرة</span>
          </button>

          {/* Demo / Simulation Mode Toggle */}
          <button
            type="button"
            onClick={onToggleSimulation}
            className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              connectionMode === 'simulation'
                ? 'border-cyan-400/60 bg-cyan-500/18 text-cyan-200 hover:bg-cyan-500/25'
                : 'border-slate-700/80 bg-[#0D1424] text-slate-200 hover:border-cyan-500/40 hover:text-white'
            }`}
          >
            {connectionMode === 'simulation' ? (
              <Radio className="h-4 w-4 text-cyan-400" />
            ) : (
              <Activity className="h-4 w-4 text-slate-400" />
            )}
            <span>وضع المحاكاة</span>
            <span className="hidden font-mono-num text-[11px] opacity-75 md:inline" dir="ltr">
              Demo
            </span>
          </button>

          {/* Selectable Baud Rate Dropdown (115200 USB / 9600 HC-05/HC-06 Bluetooth) */}
          <div className="flex items-center">
            <label htmlFor="baud-rate-select" className="sr-only">
              معدل البود (Baud Rate)
            </label>
            <select
              id="baud-rate-select"
              value={baudRate}
              disabled={connectionMode === 'connected' || isConnecting}
              onChange={(e) => onChangeBaudRate(Number(e.target.value) as 115200 | 9600)}
              title="اختيار سرعة الاتصال التسلسلي (USB أو بلوتوث HC-05/HC-06)"
              className="h-10 rounded-lg border border-slate-700/90 bg-[#0D1424] px-2.5 text-xs font-medium text-slate-100 transition-colors hover:border-cyan-500/50 focus:border-cyan-400 focus:outline-none disabled:opacity-50 cursor-pointer"
            >
              <option value={115200}>115200 · كابل USB</option>
              <option value={9600}>9600 · بلوتوث HC-05/HC-06</option>
            </select>
          </div>

          {/* Web Serial Connect / Disconnect Arduino CTA */}
          {connectionMode === 'connected' ? (
            <button
              type="button"
              onClick={onDisconnectArduino}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/15 px-4 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/25 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Unplug className="h-4 w-4" />
              <span>فصل الأردوينو</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnectArduino}
              disabled={isConnecting}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-500 px-4 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Usb className="h-4 w-4" />
              <span>{isConnecting ? 'جاري الربط...' : 'ربط بالأردوينو'}</span>
              <span className="hidden font-mono-num text-[11px] font-semibold opacity-80 sm:inline" dir="ltr">
                Connect Arduino
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
