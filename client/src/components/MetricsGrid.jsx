import React from 'react';
import {
  Thermometer,
  Droplets,
  Wind,
  DoorClosed,
  DoorOpen,
  Clock
} from 'lucide-react';
import { getGasStatusColor } from '../utils/formatters';

export const MetricsGrid = ({ deviceState, isOnline }) => {
  const temp = deviceState?.temperature;
  const hum = deviceState?.humidity;
  const rawGas = deviceState?.gasValue;
  const gasStatus = deviceState?.gasStatus;
  const doorStatus = deviceState?.doorStatus;
  const doorAlarm = deviceState?.doorAlarm;
  const temperatureAlarm = deviceState?.temperatureAlarm;
  const humidityAlarm = deviceState?.humidityAlarm;
  const rtcTime = deviceState?.rtcTime || '--:--';

  const gasColors = getGasStatusColor(gasStatus);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      
      {/* 1. TEMPERATURE CARD */}
      <div className="bg-white dark:bg-[#111114] rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 p-5 shadow-sm card-hover flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Temperature
          </span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
            temperatureAlarm
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
              : 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
          }`}>
            <Thermometer className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline space-x-1.5">
              <span className={`text-3xl font-extrabold tracking-tight font-mono ${
                temperatureAlarm ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
              }`}>
                {temp !== null && temp !== undefined ? Number(temp).toFixed(1) : '--'}
              </span>
              <span className="text-lg font-bold text-slate-500 dark:text-zinc-400">°C</span>
            </div>
            {temperatureAlarm && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700/60 animate-pulse">
                ALARM ≥8°C
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. HUMIDITY CARD */}
      <div className="bg-white dark:bg-[#111114] rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 p-5 shadow-sm card-hover flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Humidity
          </span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
            humidityAlarm
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
              : 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400'
          }`}>
            <Droplets className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline space-x-1.5">
              <span className={`text-3xl font-extrabold tracking-tight font-mono ${
                humidityAlarm ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
              }`}>
                {hum !== null && hum !== undefined ? Math.round(hum) : '--'}
              </span>
              <span className="text-lg font-bold text-slate-500 dark:text-zinc-400">%</span>
            </div>
            {humidityAlarm && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700/60 animate-pulse">
                ALARM ≥80%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. GAS / AIR QUALITY CARD */}
      <div className="bg-white dark:bg-[#111114] rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 p-5 shadow-sm card-hover flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Air Quality / Gas
          </span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${gasColors.bg} ${gasColors.text}`}>
            <Wind className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-mono">
                {rawGas !== null && rawGas !== undefined ? rawGas : '--'}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase">ADC</span>
            </div>
            {gasStatus && (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border uppercase ${gasColors.badge}`}>
                {gasStatus}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. REFRIGERATOR DOOR CARD */}
      <div className="bg-white dark:bg-[#111114] rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 p-5 shadow-sm card-hover flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Door Status
          </span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
            doorAlarm
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
              : doorStatus === 'OPEN'
              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
          }`}>
            {doorStatus === 'OPEN' || doorAlarm ? (
              <DoorOpen className="w-5 h-5 stroke-[2.2]" />
            ) : (
              <DoorClosed className="w-5 h-5 stroke-[2.2]" />
            )}
          </div>
        </div>
        <div className="mt-1">
          <div className="flex items-center justify-between">
            <span className={`text-2xl font-extrabold tracking-tight ${
              doorAlarm
                ? 'text-rose-600 dark:text-rose-400'
                : doorStatus === 'OPEN'
                ? 'text-amber-600 dark:text-amber-400'
                : doorStatus === 'CLOSED'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-400 dark:text-zinc-500'
            }`}>
              {doorStatus || '--'}
            </span>
            {doorAlarm && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700/60 animate-pulse">
                ALARM 30s+
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 5. HARDWARE RTC CLOCK CARD */}
      <div className="bg-white dark:bg-[#111114] rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 p-5 shadow-sm card-hover flex flex-col justify-between transition-colors">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            RTC Time
          </span>
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center transition-colors">
            <Clock className="w-5 h-5 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-1">
          <div className="flex items-baseline space-x-1.5">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-mono">
              {rtcTime}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default MetricsGrid;
