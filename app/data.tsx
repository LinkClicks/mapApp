// app/data/tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Modal,
  StatusBar, ScrollView,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation, useTheme, DarkTheme } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import { logMessage, logError, isLoggingEnabled } from '../utils/logger';
import JSZip from 'jszip';
import * as DocumentPicker from 'expo-document-picker';
import { useSnackbar } from '@/context/SnackbarContext';
import { insertTrip, insertTrackingPoint, updateRouteSettings, clearRotationAndMapCenterForAllTrips } from '@/database';
import BottomNavBar from '../components/BottomNavBar';
import uuid from 'react-native-uuid';
import { useTrips } from '../context/TripsContext';

const FILE_PATH = 'app/data.tsx';

const DataScreen: React.FC = () => {
  const { colors } = useTheme();
  const colorScheme = colors.background === DarkTheme.colors.background ? 'dark' : 'light';
  const navigation = useNavigation();
  const { showMessage } = useSnackbar();
  const [modalVisible, setModalVisible] = useState(false);
  const [fileList, setFileList] = useState<{ name: string; size: string }[]>([]);

  const { loadTrips } = useTrips();
  
  const handleClearRotationAndMapCenter = async () => {
    try {
      await clearRotationAndMapCenterForAllTrips();
      await loadTrips(); 
      showMessage('Cleared rotation and map center for all trips');
    } catch (error: any) {
      logError(`${FILE_PATH} - Error in handleClearRotationAndMapCenter`, { error: error.message || error.toString(), stack: error.stack });
      showMessage('Failed to clear rotation and map center for all trips');
    }
  };

  const handleImportData = async () => {
    try {
      logMessage(`${FILE_PATH} - handleImportData called`);
  
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true,
      });
  
      if (result.canceled) {
        showMessage('Import canceled');
        return;
      }
  
      const { uri } = result.assets[0];
      logMessage(`${FILE_PATH} - Selected file URI: ${uri}`);
  
      const fileContent = await RNFS.readFile(uri, 'base64');
      logMessage(`${FILE_PATH} - Read file content of length: ${fileContent.length}`);
  
      const zip = new JSZip();
      const unzippedContent = await zip.loadAsync(fileContent, { base64: true });
      logMessage(`${FILE_PATH} - Unzipped file, processing contents`);
  
      for (const fullPath in unzippedContent.files) {
        const file = unzippedContent.files[fullPath];
        const fileName = fullPath.split('/').pop();

        if (fileName && fileName.endsWith('.json')) {
          const fileData = await file.async('string');
    
          logMessage(`${FILE_PATH} - Processing file: ${fullPath} (name: ${fileName}) with content length: ${fileData.length}`);
    
          if (fileData.trim().length === 0) {
            logMessage(`${FILE_PATH} - Skipping empty file: ${fileName}`);
            continue;
          }
    
          let jsonData;
          try {
            jsonData = JSON.parse(fileData);
          } catch (parseError) {
            logError(`${FILE_PATH} - JSON Parse error for file: ${fileName}`, parseError);
            showMessage(`Failed to parse JSON in ${fileName}`);
            continue;
          }
    
          if (fileName === 'trip_data.json') {
            const newTripId = uuid.v4() as string;
            const {
              startTime, endTime, distance, duration, maxSpeed,
              elevationGainBarometer, elevationGainLocation, caloriesBurned, rotationAngle,
              routeDimensions, mapCenter
            } = jsonData;
    
            if (!startTime || !endTime || startTime <= 0 || endTime <= 0) {
              logMessage(`${FILE_PATH} - Invalid timestamps in trip data, skipping trip import`);
              continue;
            }
    
            try {
              await insertTrip(
                newTripId, startTime, endTime, distance, duration, maxSpeed,
                elevationGainBarometer, elevationGainLocation, caloriesBurned
              );
    
              const rotation = rotationAngle ?? null;
              const width = routeDimensions?.width ?? null;
              const height = routeDimensions?.height ?? null;
              const center = mapCenter ?? null;
    
              if (rotation || width || height || center) {
                await updateRouteSettings(newTripId, rotation, width, height, center);
              }
            } catch (error) {
              logError(`${FILE_PATH} - Error inserting trip data`, { error });
              showMessage(`Failed to insert trip data for trip ${newTripId}`);
            }
    
            const trackingPointsFile = fullPath.replace('trip_data.json', 'tracking_points.json');
            if (unzippedContent.files[trackingPointsFile]) {
              const trackingPointsData = await unzippedContent.files[trackingPointsFile].async('string');
              const trackingPoints = JSON.parse(trackingPointsData);
              for (const trackingPoint of trackingPoints) {
                const {
                  timestamp, latitude, longitude, speed, maxSpeed, avgSpeed,
                  altitudeBarometer, altitudeLocation, barometricPressure, heading
                } = trackingPoint;
    
                try {
                  await insertTrackingPoint(
                    newTripId, timestamp, latitude ?? null, longitude ?? null, speed, maxSpeed, avgSpeed,
                    altitudeBarometer, altitudeLocation, barometricPressure, heading
                  );
                } catch (error) {
                  logError(`${FILE_PATH} - Error inserting tracking point`, { error });
                }
              }
            }
    
          }
      
      } else {
        logMessage(`${FILE_PATH} - Unknown file type, skipping: ${fileName}`);
      }
      }
      await loadTrips();
      showMessage('Data imported successfully');
    } catch (error: any) {
      logError(`${FILE_PATH} - Error in handleImportData`, { error: error.message || error.toString(), stack: error.stack });
      showMessage('Failed to import data');
    }
  };
  
  return (
    <SafeAreaView style={[styles.container, colorScheme === 'dark' ? styles.darkContainer : styles.lightContainer]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Data Stuff',
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
          },
          headerTintColor: colors.text,
          headerLeft: () => (
            <View style={styles.headerLeftContainer}>
              <TouchableOpacity
                hitSlop={{ top: 50, bottom: 50, left: 50, right: 50 }}
                onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
                style={styles.menuButton}
              >
                <Ionicons name="menu" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Import Data button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.shareButton} onPress={handleImportData}>
            <Text style={styles.shareButtonText}>Import Data</Text>
          </TouchableOpacity>
        </View>

        {/* Clear Rotation and Map Center button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.clearButton} onPress={handleClearRotationAndMapCenter}>
            <Text style={styles.clearButtonText}>Clear Rotation and Map Center</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BottomNavBar
        colorScheme={colorScheme}
        handleStartStop={() => {}}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  lightContainer: {
    backgroundColor: '#fff',
  },
  content: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  headerLeftContainer: {
    marginLeft: 10,
  },
  menuButton: {
    marginLeft: 10,
  },
  buttonContainer: {
    width: '90%',
    marginTop: 20, // Add spacing between buttons
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: '#1e90ff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#ff6347',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default DataScreen;
