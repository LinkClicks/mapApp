// utils/distanceCalculator.ts
import { logError, logMessage } from './logger';

export function calculateDistance(location1: { latitude: number; longitude: number }, location2: { latitude: number; longitude: number }): number {
    try {
      const lat1 = location1.latitude;
      const lon1 = location1.longitude;
      const lat2 = location2.latitude;
      const lon2 = location2.longitude;
  
      const R = 6371; // Radius of the Earth in kilometers
      const dLat = degreesToRadians(lat2 - lat1);
      const dLon = degreesToRadians(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in kilometers
  
      logMessage(`Calculated distance between (${lat1}, ${lon1}) and (${lat2}, ${lon2}) is ${distance} km`);
      return distance;
    } catch (error) {
      logError('Error calculating distance', error);
      return 0; // Return 0 in case of an error
    }
  }
  
  function degreesToRadians(degrees: number): number {
    try {
      const radians = degrees * (Math.PI / 180);
      //logMessage(`Converted ${degrees} degrees to ${radians}`);
      return radians;
    } catch (error) {
      logError('Error converting degrees to radians', error);
      return 0; // Return 0 in case of an error
    }
  }
  