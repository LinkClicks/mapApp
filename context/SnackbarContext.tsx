import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar } from 'react-native-paper';
import { useOrientation } from '@/context/OrientationContext';
import { logMessage, logError } from '../utils/logger';


const FILE_PATH = 'app/contexts/SnackbarContext.tsx';

type SnackbarContextType = {
  showMessage: (message: string, color?: string, action?: () => void) => void;
};

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export const SnackbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [color, setColor] = useState('#4CAF50'); // Default color (green)
  const [snackbarAction, setSnackbarAction] = useState<(() => void) | undefined>(undefined);

  const { isLandscape } = useOrientation();

  const showMessage = useCallback((msg: string, color: string = '#4CAF50', action?: () => void) => {
    try {
      logMessage(`${FILE_PATH} - showMessage - Showing message: ${msg} with color: ${color}`);
      setMessage(msg);
      setColor(color); // Set the color based on the parameter
      setSnackbarAction(() => action);
      setVisible(true);
    } catch (error) {
      logError(`${FILE_PATH} - showMessage - Error showing message`, error);
    }
  }, []);

  const onDismiss = useCallback(() => {
    try {
      logMessage(`${FILE_PATH} - onDismiss - Dismissing message`);
      setVisible(false);
      setSnackbarAction(undefined);
    } catch (error) {
      logError(`${FILE_PATH} - onDismiss - Error dismissing message`, error);
    }
  }, []);

  return (
    <SnackbarContext.Provider value={{ showMessage }}>
      {children}
      <Snackbar
        visible={visible}
        onDismiss={onDismiss}
        duration={3000}
        action={
          snackbarAction && {
            label: 'View',
            onPress: snackbarAction,
          }
        }
        style={{
          backgroundColor: color,
          marginBottom: isLandscape ? 0 : 60, // Adjust based on orientation
          marginRight: isLandscape ? 60 : 0, // Add right margin in landscape mode to avoid the navigation bar
        }}
      >
        {message}
      </Snackbar>
    </SnackbarContext.Provider>
  );
};

export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  if (context === undefined) {
    const error = new Error('useSnackbar must be used within a SnackbarProvider');
    logError(`${FILE_PATH} - useSnackbar - Error accessing context`, error);
    throw error;
  }
  return context;
};
