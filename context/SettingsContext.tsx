// context/SettingsContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logMessage, logError } from '../utils/logger';

import { differenceInYears } from 'date-fns';

const FILE_PATH = 'context/SettingsContext.tsx';

type Resolution = {
  width: number;
  height: number;
};

export const resolutionMap: Record<string, Resolution> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4K': { width: 3840, height: 2160 },
};

type SettingsContextType = {
  unit: 'Metric' | 'Imperial' | null;
  sex: string | null;
  bikeType: string | null;
  height: string;
  metricWeight: string;
  imperialWeight: string;
  feet: string | null;
  inches: string | null;
  colorScheme: 'System' | 'Dark' | 'Light';
  age: number | null;
  videoResolution: string;
  frameRate: 30 | 60;
  stabilization: 'off' | 'cinematic' | 'cinematic-extended';
  fetchHealthData: boolean;
};

type SettingsProviderProps = {
  children: ReactNode;
};

const defaultSettings: SettingsContextType = {
  unit: null,
  sex: null,
  bikeType: null,
  height: '',
  metricWeight: '',
  imperialWeight: '',
  feet: null,
  inches: null,
  colorScheme: 'Dark',
  age: null,
  videoResolution: '1080p',
  frameRate: 30,
  stabilization: 'cinematic-extended',
  fetchHealthData: true,
};

export const SettingsContext = createContext<{
  settings: SettingsContextType;
  updateSettings: (newSettings: Partial<SettingsContextType>) => Promise<void>; 
}>({
  settings: defaultSettings,
  updateSettings: async () => {},  
});

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<SettingsContextType>(defaultSettings);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const keys = [
          'unit',
          'sex',
          'bikeType',
          'height',
          'metricWeight',
          'imperialWeight',
          'feet',
          'inches',
          'colorScheme',
          'age',
          'videoResolution',
          'frameRate',
          'stabilization',
          'fetchHealthData',
        ];
        const savedSettings = await AsyncStorage.multiGet(keys);
        const newSettings: SettingsContextType = { ...defaultSettings };

        savedSettings.forEach(([key, value]) => {
          if (value !== null && key in newSettings) {
            if (key === 'videoResolution' && value in resolutionMap) {
              newSettings[key] = value;
            } else if (key === 'frameRate') {
              newSettings[key] = parseInt(value, 10) as 30 | 60;
            } else if (key === 'stabilization') {
              newSettings[key] = value as 'off' | 'cinematic' | 'cinematic-extended';
            } else if (key === 'age') {
              newSettings[key] = parseInt(value, 10);
            } else {
              (newSettings[key as keyof SettingsContextType] as any) = value;
            }
          }
        });

        logMessage(`${FILE_PATH} - loadSettings - Loaded settings from AsyncStorage: ${JSON.stringify(newSettings)}`);
        setSettings(newSettings);
      } catch (error) {
        logError(`${FILE_PATH} - loadSettings - Error loading settings from AsyncStorage`, error);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<SettingsContextType>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      logMessage(`${FILE_PATH} - updateSettings - Updating settings: ${JSON.stringify(updatedSettings)}`);
      setSettings(updatedSettings);
      await saveSettings(updatedSettings);
    } catch (error) {
      logError(`${FILE_PATH} - updateSettings - Error updating settings`, error);
    }
  };

  const saveSettings = async (newSettings: SettingsContextType) => {
    try {
      logMessage(`${FILE_PATH} - saveSettings - Saving settings: ${JSON.stringify(newSettings)}`);
      const entries = Object.entries(newSettings).map(([key, value]) => [key, value !== null ? String(value) : '']);
      await AsyncStorage.multiSet(entries as [string, string][]);
      logMessage(`${FILE_PATH} - saveSettings - Saved settings to AsyncStorage: ${JSON.stringify(newSettings)}`);
    } catch (error) {
      logError(`${FILE_PATH} - saveSettings - Error saving settings to AsyncStorage`, error);
    }
  };


  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    const error = new Error('useSettings must be used within a SettingsProvider');
    logError(`${FILE_PATH} - useSettings - Error accessing context`, error);
    throw error;
  }
  return context;
};
