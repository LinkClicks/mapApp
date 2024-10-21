// utils/caloriesCalculator.ts
import { logError, logMessage } from './logger';

export function calculateCalories(
  speedKmh: number,
  elapsedSeconds: number,
  elevationGain: number,
  weight: number,
  age: number,
  sex: string,
  heightInCm: number,
  bikeType: string | null // bikeType might be null
): number {
  try {
    const weightInKg = weight; // Use weight in kg directly

    logMessage(`Calculating calories. Speed: ${speedKmh}, Elapsed seconds: ${elapsedSeconds}, Elevation gain: ${elevationGain}, Weight: ${weightInKg}, Age: ${age}, Sex: ${sex}, Height: ${heightInCm}, Bike type: ${bikeType}`);

    // Only calculate calories if speed is greater than 2 km/h
    if (speedKmh < 2) {
      logMessage(`Speed less than 2 km/h. Returning 0 calories.`);
      return 0;
    }

    // Calculate MET value based on speed, bike type, and elevation change
    let met;
    if (!bikeType) {
      logMessage(`Bike type is null. Using default MET value.`);
      met = 4.0; // Default MET value when bikeType is null
    } else {
      met = getMet(speedKmh, bikeType);
    }

    if (elevationGain > 0) {
      // Climbing
      met += 2.0; // Increase MET value for climbing
    } else if (elevationGain < 0) {
      // Descending
      met -= 1.0; // Decrease MET value for descending
    }

    // Adjust MET based on sex
    if (sex === 'male') {
      met *= 1.1; // Increase MET by 10% for males
    } else if (sex === 'female') {
      met *= 0.9; // Decrease MET by 10% for females
    }

    // Adjust MET based on age
    if (age < 18) {
      met *= 1.1; // Increase MET by 10% for children
    } else if (age > 65) {
      met *= 0.9; // Decrease MET by 10% for seniors
    } else if (age >= 40 && age <= 65) {
      met *= 0.95; // Decrease MET by 5% for middle-aged individuals
    }

    // Adjust MET based on height
    const averageHeightInCm = 170; // You can use a different average if preferred
    if (heightInCm > averageHeightInCm) {
      met *= 1 + (heightInCm - averageHeightInCm) / 1000; // Slightly increase MET for taller individuals
    } else if (heightInCm < averageHeightInCm) {
      met *= 1 - (averageHeightInCm - heightInCm) / 1000; // Slightly decrease MET for shorter individuals
    }

    // Calculate calories burned per second due to activity
    const activeCaloriesPerSecond = (met * weightInKg) / 3600; // MET * weight (kg) per second

    // Update calories burned
    const newCaloriesBurned = activeCaloriesPerSecond * elapsedSeconds;

    logMessage(`Calories burned: ${newCaloriesBurned}`);
    return newCaloriesBurned;
  } catch (error) {
    logError('Error calculating calories', error);
    return 0; // Return 0 in case of an error
  }
}


function getMet(speedKmh: number, bikeType: string): number {
  try {
    if (speedKmh < -11) {
      logMessage(`Speed less than 1 km/h. Returning 0 MET.`);
      return 0;
    }

    switch (bikeType) {
      case 'road_bike':
        if (speedKmh >= 32) return 7;
        if (speedKmh >= 30) return 6;
        if (speedKmh >= 26) return 5;
        if (speedKmh >= 22) return 4;
        if (speedKmh >= 19) return 3.5;
        if (speedKmh >= 16) return 3;
        return 2.5;
      case 'city_touring_bike':
        if (speedKmh >= 32) return 8;
        if (speedKmh >= 30) return 7;
        if (speedKmh >= 26) return 6;
        if (speedKmh >= 22) return 5;
        if (speedKmh >= 19) return 4.5;
        if (speedKmh >= 16) return 4;
        return 3.5;
      case 'mountain_bike':
        if (speedKmh >= 32) return 11;
        if (speedKmh >= 30) return 9;
        if (speedKmh >= 26) return 7;
        if (speedKmh >= 22) return 6;
        if (speedKmh >= 19) return 5;
        if (speedKmh >= 16) return 4.5;
        return 4;
      case 'bmx':
        if (speedKmh >= 32) return 12.8;
        if (speedKmh >= 30) return 10.0;
        if (speedKmh >= 26) return 8.0;
        if (speedKmh >= 22) return 7.0;
        if (speedKmh >= 19) return 6.0;
        if (speedKmh >= 16) return 5.0;
        return 4.0;
      case 'e_bike':
        if (speedKmh >= 32) return 6;
        if (speedKmh >= 30) return 5;
        if (speedKmh >= 26) return 4;
        if (speedKmh >= 22) return 4.5;
        if (speedKmh >= 19) return 4;
        if (speedKmh >= 16) return 3.5;
        return 3;
      case 'electric_scooter':
        return 0; // Zero calories burned
      default:
        return 4.0;
    }
  } catch (error) {
    logError('Error getting MET value', error);
    return 4.0; // Return a default MET value in case of an error
  }
}
