import React from 'react';
import { AlertTriangle, DoorOpen, Thermometer, Droplets } from 'lucide-react';

export const AlarmBanner = ({
  doorAlarm,
  gasAlarm,
  gasValue,
  temperatureAlarm,
  humidityAlarm,
  temperature,
  humidity
}) => {
  if (!doorAlarm && !gasAlarm && !temperatureAlarm && !humidityAlarm) return null;

  return (
    <div className="space-y-3 mb-6">
      {/* 30-Second Door Open Alarm */}
      {doorAlarm && (
        <div
          id="door-alarm-banner"
          className="flex items-center justify-between p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 shadow-md shadow-rose-500/10 dark:bg-rose-950/40 dark:border-rose-600/60 dark:text-rose-100 animate-pulse transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300 flex-shrink-0">
              <DoorOpen className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-rose-900 dark:text-rose-100">
                DOOR OPEN TOO LONG
              </h3>
              <p className="text-xs sm:text-sm text-rose-700 dark:text-rose-300">
                Refrigerator door has been open for more than 30 seconds. Physical buzzer and red LED are sounding!
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md bg-rose-200 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200 dark:border dark:border-rose-700/60">
            Critical Alarm
          </span>
        </div>
      )}

      {/* High Gas Level Alarm */}
      {gasAlarm && (
        <div
          id="gas-alarm-banner"
          className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 shadow-md shadow-amber-500/10 dark:bg-amber-950/40 dark:border-amber-600/60 dark:text-amber-100 animate-pulse transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 flex-shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-amber-950 dark:text-amber-100">
                AIR QUALITY / GAS WARNING DETECTED
              </h3>
              <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                MQ135 raw reading reached <span className="font-bold font-mono">{gasValue ?? 800} ADC</span> (800+ threshold exceeded). Spoilage or odor detected!
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md bg-amber-200 text-amber-900 dark:bg-amber-900/80 dark:text-amber-200 dark:border dark:border-amber-700/60">
            Gas Alarm
          </span>
        </div>
      )}

      {/* High Temperature Alarm (8°C or above) */}
      {temperatureAlarm && (
        <div
          id="temp-alarm-banner"
          className="flex items-center justify-between p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 shadow-md shadow-rose-500/10 dark:bg-rose-950/40 dark:border-rose-600/60 dark:text-rose-100 animate-pulse transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300 flex-shrink-0">
              <Thermometer className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-rose-900 dark:text-rose-100">
                HIGH TEMPERATURE ALARM
              </h3>
              <p className="text-xs sm:text-sm text-rose-700 dark:text-rose-300">
                Temperature reading reached <span className="font-bold font-mono">{temperature !== null && temperature !== undefined ? Number(temperature).toFixed(1) : '8.0'}°C</span> (8°C threshold exceeded). Cooling check required!
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md bg-rose-200 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200 dark:border dark:border-rose-700/60">
            Temp Alarm
          </span>
        </div>
      )}

      {/* High Humidity Alarm (80% RH or above) */}
      {humidityAlarm && (
        <div
          id="humidity-alarm-banner"
          className="flex items-center justify-between p-4 rounded-xl bg-sky-50 border-2 border-sky-400 text-sky-950 shadow-md shadow-sky-500/10 dark:bg-sky-950/40 dark:border-sky-600/60 dark:text-sky-100 animate-pulse transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 flex-shrink-0">
              <Droplets className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-sky-950 dark:text-sky-100">
                HIGH HUMIDITY ALARM
              </h3>
              <p className="text-xs sm:text-sm text-sky-800 dark:text-sky-300">
                Relative humidity reading reached <span className="font-bold font-mono">{humidity !== null && humidity !== undefined ? Math.round(humidity) : '80'}%</span> (80% RH threshold exceeded). Excessive condensation detected!
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md bg-sky-200 text-sky-900 dark:bg-sky-900/80 dark:text-sky-200 dark:border dark:border-sky-700/60">
            Humidity Alarm
          </span>
        </div>
      )}
    </div>
  );
};

export default AlarmBanner;
