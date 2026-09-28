import React from 'react';
import useFreshGuard from './hooks/useFreshGuard';
import useTheme from './hooks/useTheme';
import Header from './components/Header';
import AlarmBanner from './components/AlarmBanner';
import MetricsGrid from './components/MetricsGrid';
import FoodInventory from './components/FoodInventory';
import FoodHistory from './components/FoodHistory';
import ConnectionStatus from './components/ConnectionStatus';

export function App() {
  const {
    deviceState,
    isOnline,
    inventory,
    foodHistory,
    backendConnected,
    backendError,
    lastUpdate,
    refetch
  } = useFreshGuard();

  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
      {/* 1. Header with Brand, ESP32 Live/Offline Indicator, Telemetry Time & Theme Toggle */}
      <Header
        isOnline={isOnline}
        lastUpdate={lastUpdate}
        backendConnected={backendConnected}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />

      {/* 2. Main Dashboard Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Backend Connectivity Banner (shown if backend is restarting/unavailable) */}
        <ConnectionStatus backendError={backendError} onRetry={refetch} />

        {/* Physical Alarm Alert Banners (Door Open, Gas >= 800, Temp >= 8°C, Hum >= 80%) */}
        <AlarmBanner
          doorAlarm={deviceState?.doorAlarm}
          gasAlarm={deviceState?.gasAlarm}
          gasValue={deviceState?.gasValue}
          temperatureAlarm={deviceState?.temperatureAlarm}
          humidityAlarm={deviceState?.humidityAlarm}
          temperature={deviceState?.temperature}
          humidity={deviceState?.humidity}
        />

        {/* 5 Hardware Sensor Metric Cards */}
        <MetricsGrid
          deviceState={deviceState}
          isOnline={isOnline}
        />

        {/* 2-Column Split: Active Food Inventory & Persistent RFID History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="h-full">
            <FoodInventory inventory={inventory} />
          </section>

          <section className="h-full">
            <FoodHistory history={foodHistory} />
          </section>
        </div>

      </main>

      {/* 3. Minimal Professional Footer */}
      <footer className="border-t border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-black py-4 mt-auto transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 dark:text-zinc-500 gap-2">
          <p>© FreshGuard. All Right Reserved.</p>
          <div className="flex items-center space-x-3">
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              <span className="text-slate-500 dark:text-zinc-400">Gateway: {backendConnected ? 'Connected' : 'Offline'}</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
