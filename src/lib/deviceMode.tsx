import React, { createContext, useContext, useEffect, useState } from 'react';

export type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const DEVICE_MODE_KEY = 'rkk_ac_device_mode';

function detectInitialDeviceMode(): DeviceMode {
  if (typeof window === 'undefined') return 'desktop';
  try {
    const saved = localStorage.getItem(DEVICE_MODE_KEY);
    if (saved === 'desktop' || saved === 'tablet' || saved === 'mobile') {
      return saved;
    }
    const width = window.innerWidth;
    if (width < 640) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  } catch {
    return 'desktop';
  }
}

interface DeviceModeContextValue {
  deviceMode: DeviceMode;
  setDeviceMode: (mode: DeviceMode) => void;
}

const DeviceModeContext = createContext<DeviceModeContextValue>({
  deviceMode: 'desktop',
  setDeviceMode: () => {},
});

export const DeviceModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deviceMode, setDeviceModeState] = useState<DeviceMode>(() => detectInitialDeviceMode());

  const setDeviceMode = (mode: DeviceMode) => {
    setDeviceModeState(mode);
    try {
      localStorage.setItem(DEVICE_MODE_KEY, mode);
    } catch {
      // ignore storage quota errors
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-device-mode', deviceMode);
  }, [deviceMode]);

  return (
    <DeviceModeContext.Provider value={{ deviceMode, setDeviceMode }}>
      {children}
    </DeviceModeContext.Provider>
  );
};

export function useDeviceMode(): DeviceModeContextValue {
  return useContext(DeviceModeContext);
}
