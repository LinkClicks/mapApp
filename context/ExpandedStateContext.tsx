// services/ExpandedStateContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { logMessage, logError } from '../utils/logger'; // Import the logger

const FILE_PATH = 'services/ExpandedStateContext.tsx';

interface ExpandedStateContextType {
  expandedMonths: string[];
  setExpandedMonths: React.Dispatch<React.SetStateAction<string[]>>;
  expandedDates: string[];
  setExpandedDates: React.Dispatch<React.SetStateAction<string[]>>;
}

const ExpandedStateContext = createContext<ExpandedStateContextType | undefined>(undefined);

export const ExpandedStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [expandedDates, setExpandedDates] = useState<string[]>([]);

  const handleSetExpandedMonths = (value: React.SetStateAction<string[]>) => {
    try {
      logMessage(`${FILE_PATH} - handleSetExpandedMonths - Setting expanded months: ${JSON.stringify(value)}`);
      setExpandedMonths(value);
    } catch (error) {
      logError(`${FILE_PATH} - handleSetExpandedMonths - Error setting expanded months`, error);
    }
  };

  const handleSetExpandedDates = (value: React.SetStateAction<string[]>) => {
    try {
      logMessage(`${FILE_PATH} - handleSetExpandedDates - Setting expanded dates: ${JSON.stringify(value)}`);
      setExpandedDates(value);
    } catch (error) {
      logError(`${FILE_PATH} - handleSetExpandedDates - Error setting expanded dates`, error);
    }
  };

  return (
    <ExpandedStateContext.Provider value={{ expandedMonths, setExpandedMonths: handleSetExpandedMonths, expandedDates, setExpandedDates: handleSetExpandedDates }}>
      {children}
    </ExpandedStateContext.Provider>
  );
};

export const useExpandedState = (): ExpandedStateContextType => {
  const context = useContext(ExpandedStateContext);
  if (!context) {
    const error = new Error('useExpandedState must be used within an ExpandedStateProvider');
    logError(`${FILE_PATH} - useExpandedState - Error accessing context`, error);
    throw error;
  }
  return context;
};
