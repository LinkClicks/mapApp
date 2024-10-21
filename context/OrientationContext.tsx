import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppState, AppStateStatus } from 'react-native';
import { MMKV } from 'react-native-mmkv';

type OrientationType = 'portrait' | 'landscape-left' | 'landscape-right' | null;

interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface OrientationContextType {
  orientation: OrientationType;
  insets: Insets;
  adjustedInsets: Insets;
  isLandscape: boolean;
  appState: AppStateStatus;
}

const OrientationContext = createContext<OrientationContextType | undefined>(undefined);

const storage = new MMKV();

export const OrientationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();

  const initialOrientation = (storage.getString('orientation') as OrientationType) || null;
  const initialAdjustedInsets = storage.getString('adjustedInsets')
    ? (JSON.parse(storage.getString('adjustedInsets')!) as Insets)
    : insets;

  const [orientation, setOrientation] = useState<OrientationType>(initialOrientation);
  const [adjustedInsets, setAdjustedInsets] = useState<Insets>(initialAdjustedInsets);
  const [appState, setAppState] = useState(AppState.currentState);

  const isLandscape = orientation === 'landscape-left' || orientation === 'landscape-right';

  const updateAdjustedInsets = (newOrientation: OrientationType) => {
    let newInsets = insets;

    console.log('Updating adjusted insets for orientation: ', newOrientation);
    console.log('Current insets: ', insets);

    if (newOrientation === 'landscape-left') {
      newInsets = { ...insets, left: 0 };
    } else if (newOrientation === 'landscape-right') {
      newInsets = { ...insets, right: 0 };
    }

    setAdjustedInsets(newInsets);
    storage.set('adjustedInsets', JSON.stringify(newInsets));
  };

  const handleOrientationChange = async () => {
    try {
      const orientationInfo = await ScreenOrientation.getOrientationAsync();
      const newOrientation =
        orientationInfo === ScreenOrientation.Orientation.LANDSCAPE_LEFT
          ? 'landscape-left'
          : orientationInfo === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
          ? 'landscape-right'
          : 'portrait';
      setOrientation(newOrientation);
      storage.set('orientation', newOrientation);
      console.log('Orientation changed to: ', newOrientation);
    } catch (error) {
      console.error('Error detecting orientation: ', error);
    }
  };

  useEffect(() => {
    handleOrientationChange(); // Detect initial orientation

    const subscription = ScreenOrientation.addOrientationChangeListener(() => {
      handleOrientationChange();
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, []);

  // Handle app state change (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setAppState(nextAppState);
      if (nextAppState === 'active') {
        handleOrientationChange();
      }
    };

    const appStateListener = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateListener.remove();
    };
  }, []);

  useEffect(() => {
    updateAdjustedInsets(orientation);
  }, [orientation, insets]);

  return (
    <OrientationContext.Provider value={{ orientation, insets, adjustedInsets, isLandscape, appState }}>
      {children}
    </OrientationContext.Provider>
  );
};

export const useOrientation = () => {
  const context = useContext(OrientationContext);
  if (!context) {
    throw new Error('useOrientation must be used within an OrientationProvider');
  }
  return context;
};
