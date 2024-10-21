// context/AdvancedModeContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logMessage, logError } from '../utils/logger';

const FILE_PATH = 'context/AdvancedModeContext.tsx';

interface AdvancedModeContextProps {
  isAdvanced: boolean;
  setIsAdvanced: (value: boolean) => void;
}

interface AdvancedModeProviderProps {
  children: ReactNode;
}

const AdvancedModeContext = createContext<AdvancedModeContextProps>({
  isAdvanced: false,
  setIsAdvanced: () => {},
});

export const useAdvancedMode = () => {
  const context = useContext(AdvancedModeContext);
  if (context === undefined) {
    const error = new Error('useAdvancedMode must be used within an AdvancedModeProvider');
    logError(`${FILE_PATH} - useAdvancedMode - Error accessing context`, error);
    throw error;
  }
  //logMessage(`${FILE_PATH} - useAdvancedMode - Accessing AdvancedMode context`);
  return context;
};

export const AdvancedModeProvider: React.FC<AdvancedModeProviderProps> = ({ children }) => {
  const [isAdvanced, setIsAdvancedState] = useState(false);

  useEffect(() => {
    const loadAdvancedMode = async () => {
      try {
        logMessage(`${FILE_PATH} - loadAdvancedMode - Loading advanced mode state`);
        const value = await AsyncStorage.getItem('isAdvanced');
        if (value !== null) {
          setIsAdvancedState(JSON.parse(value));
        }
        logMessage(`${FILE_PATH} - loadAdvancedMode - Loaded advanced mode state: ${value}`);
      } catch (error) {
        logError(`${FILE_PATH} - loadAdvancedMode - Error loading advanced mode state from AsyncStorage`, error);
      }
    };
    loadAdvancedMode();
  }, []);

  const setIsAdvanced = useCallback(async (value: boolean) => {
    try {
      logMessage(`${FILE_PATH} - setIsAdvanced - Setting advanced mode state to: ${value}`);
      await AsyncStorage.setItem('isAdvanced', JSON.stringify(value));
      setIsAdvancedState(value);
    } catch (error) {
      logError(`${FILE_PATH} - setIsAdvanced - Error setting advanced mode state to AsyncStorage`, error);
    }
  }, []);

  return (
    <AdvancedModeContext.Provider value={{ isAdvanced, setIsAdvanced }}>
      {children}
    </AdvancedModeContext.Provider>
  );
};
