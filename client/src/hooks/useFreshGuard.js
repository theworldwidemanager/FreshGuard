import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import socket from '../services/socket';

const OFFLINE_TIMEOUT_MS = 15000;

export const useFreshGuard = () => {
  const [deviceState, setDeviceState] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [foodHistory, setFoodHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const [backendError, setBackendError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const lastSeenRef = useRef(null);

  // Initial data load from MongoDB Atlas via REST endpoints
  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setBackendError(null);

    try {
      // 1. Fetch current device status
      const statusRes = await api.getDeviceStatus('freshguard-fridge-01');
      if (statusRes.data) {
        setDeviceState(statusRes.data);
        lastSeenRef.current = statusRes.data.lastSeen;
        setLastUpdate(statusRes.data.lastSeen);

        const timeDiff = Date.now() - new Date(statusRes.data.lastSeen).getTime();
        setIsOnline(timeDiff <= OFFLINE_TIMEOUT_MS);
      } else {
        // Empty database: no telemetry has ever been recorded
        setDeviceState(null);
        setIsOnline(false);
      }

      // 2. Fetch active food inventory
      const inventoryRes = await api.getInventory();
      if (inventoryRes.data) {
        setInventory(inventoryRes.data);
      }

      // 3. Fetch historical RFID food actions
      const historyRes = await api.getFoodHistory(50);
      if (historyRes.data) {
        setFoodHistory(historyRes.data);
      }
    } catch (err) {
      console.warn('Backend initial fetch note:', err.message);
      setBackendError('Backend service currently unavailable or starting up...');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();

    // Socket.IO lifecycle listeners
    const handleConnect = () => {
      setBackendConnected(true);
      setBackendError(null);
    };

    const handleDisconnect = () => {
      setBackendConnected(false);
    };

    const handleConnectError = (error) => {
      setBackendConnected(false);
      setBackendError('Disconnected from real-time gateway');
    };

    // Real-time Event: Device Telemetry Update
    const handleDeviceUpdate = (data) => {
      if (!data) return;
      setDeviceState(data);
      lastSeenRef.current = data.lastSeen;
      setLastUpdate(data.lastSeen || new Date().toISOString());

      // If payload explicitly carries isOnline or evaluate timestamp
      if (typeof data.isOnline === 'boolean') {
        setIsOnline(data.isOnline);
      } else if (data.lastSeen) {
        const diff = Date.now() - new Date(data.lastSeen).getTime();
        setIsOnline(diff <= OFFLINE_TIMEOUT_MS);
      }
    };

    // Real-time Event: Active Inventory Update
    const handleInventoryUpdate = (data) => {
      if (Array.isArray(data)) {
        setInventory(data);
      }
    };

    // Real-time Event: Food History Event (RFID Scan Added/Removed)
    const handleFoodUpdate = (newEvent) => {
      if (!newEvent) return;
      setFoodHistory((prev) => {
        // Prevent duplicate IDs if received concurrently
        const exists = prev.some((item) => (item._id && item._id === newEvent._id));
        if (exists) return prev;
        return [newEvent, ...prev];
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // Synchronized event names
    socket.on('device', handleDeviceUpdate);
    socket.on('inventory', handleInventoryUpdate);
    socket.on('food', handleFoodUpdate);

    if (socket.connected) {
      setBackendConnected(true);
    }

    // Dynamic offline detection timer: checks every 1000ms
    const offlineCheckInterval = setInterval(() => {
      if (lastSeenRef.current) {
        const elapsed = Date.now() - new Date(lastSeenRef.current).getTime();
        if (elapsed > OFFLINE_TIMEOUT_MS) {
          setIsOnline(false);
        }
      }
    }, 1000);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('device', handleDeviceUpdate);
      socket.off('inventory', handleInventoryUpdate);
      socket.off('food', handleFoodUpdate);
      clearInterval(offlineCheckInterval);
    };
  }, [fetchInitialData]);

  return {
    deviceState,
    isOnline,
    inventory,
    foodHistory,
    isLoading,
    backendConnected,
    backendError,
    lastUpdate,
    refetch: fetchInitialData
  };
};

export default useFreshGuard;
