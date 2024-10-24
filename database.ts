// database.ts
import * as SQLite from 'expo-sqlite/legacy';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { GroupedTrip, Trip, TrackingPoint, FlaggedTimestamp } from './types';
import * as FileSystem from 'expo-file-system';
import { logMessage, logError } from './utils/logger';

const FILE_PATH = 'database.ts';

interface TripData {
  id: string;
  start_time: number;
  end_time: number;
  distance: number;
  duration: number;
  max_speed: number;
  elevation_gain_barometer: number | null;
  elevation_gain_location: number | null;
  calories_burned: number | null;
  rotation_angle: number | null;
  route_width: number | null;
  route_height: number | null;
  map_center_latitude: number | null;
  map_center_longitude: number | null;
  map_altitude: number | null;
}

const db = SQLite.openDatabase('mapApp.db');

const migrations = [
  {
    version: 1,
    up: (tx: SQLite.SQLTransaction) => {
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS trips (
          id TEXT PRIMARY KEY,
          start_time INTEGER,
          end_time INTEGER,
          duration INTEGER,
          distance REAL,
          max_speed REAL,
          elevation_gain_barometer REAL,
          elevation_gain_location REAL,
          calories_burned REAL
        );
      `);
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS tracking_points (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip_id TEXT,
          timestamp INTEGER,
          latitude REAL,
          longitude REAL,
          speed REAL,
          max_speed REAL,
          avg_speed REAL,
          altitude_barometer REAL,
          altitude_location REAL,
          barometric_pressure REAL,
          heading REAL,
          FOREIGN KEY (trip_id) REFERENCES trips (id)
        );
      `);
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS flagged_timestamps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trip_id TEXT,
          timestamp INTEGER,
          latitude REAL,
          longitude REAL,
          FOREIGN KEY (trip_id) REFERENCES trips (id)
        );
      `);
    },
  },
  {
    version: 2,
    up: (tx: SQLite.SQLTransaction) => {
      tx.executeSql(
        "PRAGMA table_info(trips);",
        [],
        (_, { rows }) => {
          const columnExists = rows._array.some(row => row.name === 'rotation_angle');
          if (!columnExists) {
            tx.executeSql(`
              ALTER TABLE trips ADD COLUMN rotation_angle REAL DEFAULT 0;
            `);
          }
        }
      );
    },
  },
  {
    version: 3,
    up: (tx: SQLite.SQLTransaction) => {
      tx.executeSql(
        "PRAGMA table_info(trips);",
        [],
        (_, { rows }) => {
          const hasLatitude = rows._array.some(row => row.name === 'map_center_latitude');
          const hasLongitude = rows._array.some(row => row.name === 'map_center_longitude');
          
          if (!hasLatitude) {
            tx.executeSql(`
              ALTER TABLE trips ADD COLUMN map_center_latitude REAL DEFAULT NULL;
            `);
          }

          if (!hasLongitude) {
            tx.executeSql(`
              ALTER TABLE trips ADD COLUMN map_center_longitude REAL DEFAULT NULL;
            `);
          }
        }
      );
    },
  },
  {
    version: 4, 
    up: (tx: SQLite.SQLTransaction) => {
      tx.executeSql(
        "PRAGMA table_info(trips);",
        [],
        (_, { rows }) => {
          const hasWidth = rows._array.some(row => row.name === 'route_width');
          const hasHeight = rows._array.some(row => row.name === 'route_height');
          
          if (!hasWidth) {
            tx.executeSql(`
              ALTER TABLE trips ADD COLUMN route_width REAL DEFAULT NULL;
            `);
          }

          if (!hasHeight) {
            tx.executeSql(`
              ALTER TABLE trips ADD COLUMN route_height REAL DEFAULT NULL;
            `);
          }
        }
      );
    },
  },
  {
    version: 5,
    up: (tx: SQLite.SQLTransaction) => {
      tx.executeSql(
        "PRAGMA table_info(trips);",
        [],
        (_, { rows }) => {
          const hasMapAltitude = rows._array.some(row => row.name === 'map_altitude');
          
          if (!hasMapAltitude) {
            tx.executeSql(`
              ALTER TABLE trips ADD COLUMN map_altitude REAL DEFAULT NULL;
            `);
          }
        }
      );
    },
  },
];

export const initDB = async (): Promise<void> => {
  try {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql('PRAGMA user_version', [], (_, { rows }) => {
          const currentVersion = rows.item(0).user_version || 0;
          logMessage(`Current DB version: ${currentVersion}`);
          const applyMigrations = (tx: SQLite.SQLTransaction, currentVersion: number) => {
            migrations.forEach(migration => {
              if (migration.version > currentVersion) {
                logMessage(`Applying migration for version ${migration.version}`);
                migration.up(tx);
              }
            });
            tx.executeSql(`PRAGMA user_version = ${migrations[migrations.length - 1].version}`);
          };

          applyMigrations(tx, currentVersion);
        }, (tx, error) => {
          logError('Error fetching database version', error);
          reject(error);
          return false;
        });
      }, error => {
        logError('Error initializing database', error);
        reject(error);
      }, () => {
        logMessage('Database initialized successfully');
        resolve();
      });
    });
  } catch (error) {
    logError('General error during DB initialization', error);
    throw error;
  }
};

export const insertFlaggedTimestamp = async (
  tripId: string | null,
  timestamp: number,
  latitude: number | null,
  longitude: number | null,
  altitude?: number // Optional if you're storing altitude
): Promise<void> => {
  try {
    db.transaction(tx => {
      tx.executeSql(
        'INSERT INTO flagged_timestamps (trip_id, timestamp, latitude, longitude) VALUES (?, ?, ?, ?);',
        [tripId, timestamp, latitude, longitude],
        () => {
          logMessage(`${FILE_PATH} - insertFlaggedTimestamp - Flagged timestamp inserted for trip ID: ${tripId}`);
        },
        (tx, error) => {
          logError(`${FILE_PATH} - insertFlaggedTimestamp - Error inserting flagged timestamp`, error);
          return false;
        }
      );
    });
  } catch (error) {
    logError(`${FILE_PATH} - insertFlaggedTimestamp - General error`, error);
    throw error;
  }
};

export const deleteFlaggedTimestamp = async (timestamp: number): Promise<void> => {
  try {
    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM flagged_timestamps WHERE timestamp = ?;',
        [timestamp],
        () => {
          logMessage(`${FILE_PATH} - deleteFlaggedTimestamp - Flagged timestamp deleted for timestamp: ${timestamp}`);
        },
        (tx, error) => {
          logError(`${FILE_PATH} - deleteFlaggedTimestamp - Error deleting flagged timestamp`, error);
          return false;
        }
      );
    });
  } catch (error) {
    logError(`${FILE_PATH} - deleteFlaggedTimestamp - General error`, error);
    throw error;
  }
};


export const insertTrip = async (
  id: string,
  startTime: number,
  endTime: number,
  distance: number,
  duration: number,
  maxSpeed: number,
  elevationGainBarometer: number,
  elevationGainLocation: number,
  caloriesBurned: number
): Promise<void> => {
  try {
    db.transaction(tx => {
      tx.executeSql('INSERT INTO trips (id, start_time, end_time, distance, duration, max_speed, elevation_gain_barometer, elevation_gain_location, calories_burned ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [id, startTime, endTime, distance, duration, maxSpeed, elevationGainBarometer, elevationGainLocation, caloriesBurned],
        () => {
          logMessage(`${FILE_PATH} - insertTrip - Trip inserted with ID: ${id}`);
        },
        (tx, error) => {
          logError(`${FILE_PATH} - insertTrip - Error inserting trip`, error);
          return false;
        });
    });
  } catch (error) {
    logError(`${FILE_PATH} - insertTrip - General error`, error);
    throw error;
  }
};

export const updateRouteSettings = async (
  id: string,
  rotationAngle: number,
  width: number,
  height: number,
  mapCenter: { latitude: number, longitude: number },
  mapAltitude: number
): Promise<void> => {
  try {
    db.transaction(tx => {
      tx.executeSql(
        'UPDATE trips SET rotation_angle = ?, route_width = ?, route_height = ?, map_center_latitude = ?, map_center_longitude = ?, map_altitude = ? WHERE id = ?;',
        [rotationAngle, width, height, mapCenter.latitude, mapCenter.longitude, mapAltitude, id],
        () => {
          logMessage(`${FILE_PATH} - updateRouteSettings - Route settings updated for trip ID: ${id}. Rotation angle: ${rotationAngle}, width: ${width}, height: ${height}, map center: ${mapCenter.latitude}, ${mapCenter.longitude}, map altitude: ${mapAltitude}`);
        },
        (tx, error) => {
          logError(`${FILE_PATH} - updateRouteSettings - Error updating route settings`, error);
          return false;
        }
      );
    });
  } catch (error) {
    logError(`${FILE_PATH} - updateRouteSettings - General error`, error);
    throw error;
  }
}

export const updateTrip = async (
  id: string,
  endTime: number,
  distance: number,
  duration: number,
  elevationGainBarometer: number,
  elevationGainLocation: number,
  maxSpeed: number,
  caloriesBurned: number,
): Promise<void> => {
  try {
    db.transaction(tx => {
      tx.executeSql(
        'UPDATE trips SET end_time = ?, distance = ?, duration = ?, elevation_gain_barometer = ?, elevation_gain_location = ?, max_speed = ?, calories_burned = ? WHERE id = ?;',
        [endTime, distance, duration, elevationGainBarometer, elevationGainLocation, maxSpeed, caloriesBurned, id],
        () => {
          logMessage(`${FILE_PATH} - updateTrip - Trip updated with ID: ${id}`);
        },
        (tx, error) => {
          logError(`${FILE_PATH} - updateTrip - Error updating trip`, error);
          return false;
        }
      );
    });
  } catch (error) {
    logError(`${FILE_PATH} - updateTrip - General error`, error);
    throw error;
  }
};

export const insertTrackingPoint = async (
  tripId: string,
  timestamp: number,
  latitude: number,
  longitude: number,
  speed: number,
  maxSpeed: number,
  avgSpeed: number,
  altitudeBarometer: number | null, 
  altitudeLocation: number | null, 
  barometricPressure: number | null, 
  heading: number | null, 
): Promise<void> => {
  try {
    db.transaction(tx => {
      tx.executeSql(
        'INSERT INTO tracking_points (trip_id, timestamp, latitude, longitude, speed, max_speed, avg_speed, altitude_barometer, altitude_location, barometric_pressure, heading) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [tripId, timestamp, latitude, longitude, speed, maxSpeed, avgSpeed, altitudeBarometer, altitudeLocation, barometricPressure, heading],
        () => {
          logMessage(`${FILE_PATH} - insertTrackingPoint - Tracking point inserted`);
        },
        (tx, error) => {
          logError(`${FILE_PATH} - insertTrackingPoint - Error inserting tracking point`, error);
          return false;
        }
      );
    });
  } catch (error) {
    logError(`${FILE_PATH} - insertTrackingPoint - General error`, error);
    throw error;
  }
};

export const deleteTrip = async (id: string): Promise<void> => {
  try {
    db.transaction(tx => {
      logMessage(`${FILE_PATH} - deleteTrip - Deleting trip with ID: ${id}`);
      tx.executeSql('DELETE FROM tracking_points WHERE trip_id = ?;', [id],
        () => {
          logMessage(`${FILE_PATH} - deleteTrip - Tracking points deleted for trip ID: ${id}`);
        },
        (tx, error) => {
          logError(`${FILE_PATH} - deleteTrip - Error deleting tracking points`, error);
          return false;
        });

      tx.executeSql('DELETE FROM flagged_timestamps WHERE trip_id = ?;', [id],
        () => {
          logMessage(`${FILE_PATH} - deleteTrip - Flagged timestamps deleted for trip ID: ${id}`);
        },
        (tx, error) => {
          logError(`${FILE_PATH} - deleteTrip - Error deleting flagged timestamps`, error);
          return false;
        });

      tx.executeSql('DELETE FROM trips WHERE id = ?;', [id],
        () => {
          logMessage(`${FILE_PATH} - deleteTrip - Trip deleted with ID: ${id}`);
        },
        (tx, error) => {
          logError(`${FILE_PATH} - deleteTrip - Error deleting trip`, error);
          return false;
        });
    });
  } catch (error) {
    logError(`${FILE_PATH} - deleteTrip - General error`, error);
    throw error;
  }
};


export const fetchTripsGroupedByMonth = async (): Promise<GroupedTrip[]> => {
  try {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM trips ORDER BY start_time DESC',
          [],
          async (_, { rows }) => {
            const trips = rows._array;

            const groupedData: GroupedTrip[] = [];
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            for (const row of trips) {
              const localDate = toZonedTime(new Date(row.start_time), timeZone);
              const month = format(localDate, 'yyyy-MM');
              const date = format(localDate, 'yyyy-MM-dd');
              
              const trip: Trip = {
                id: row.id,
                startTime: row.start_time,
                endTime: row.end_time,
                distance: row.distance,
                duration: row.duration,
                maxSpeed: row.max_speed,
                elevationGainBarometer: row.elevation_gain_barometer,
                elevationGainLocation: row.elevation_gain_location,
                caloriesBurned: row.calories_burned,
                rotationAngle: row.rotation_angle,
                routeDimensions: { width: row.route_width, height: row.route_height },
                mapCenter: row.map_center_latitude && row.map_center_longitude
                  ? { latitude: row.map_center_latitude, longitude: row.map_center_longitude }
                  : null, 
                mapAltitude: row.map_altitude,
                trackPoints: await fetchTrackingPoints(row.id),
                flaggedTimestamps: await fetchFlaggedTimestamps(row.id),
              };

              const monthIndex = groupedData.findIndex(group => group.month === month);
              const dateIndex = monthIndex !== -1 ? groupedData[monthIndex].data.findIndex((group: { date: string; }) => group.date === date) : -1;

              if (monthIndex === -1) {
                groupedData.push({
                  month,
                  totalDistance: row.distance,
                  totalDuration: row.duration,
                  data: [{
                    date,
                    totalDuration: row.duration,
                    totalDistance: row.distance,
                    trips: [trip],
                  }],
                });
              } else if (dateIndex === -1) {
                groupedData[monthIndex].data.push({
                  date,
                  totalDuration: row.duration,
                  totalDistance: row.distance,
                  trips: [trip],
                });
                groupedData[monthIndex].totalDistance += row.distance;
                groupedData[monthIndex].totalDuration += row.duration;
              } else {
                groupedData[monthIndex].data[dateIndex].trips.push(trip);
                groupedData[monthIndex].data[dateIndex].totalDistance += row.distance;
                groupedData[monthIndex].data[dateIndex].totalDuration += row.duration;
              }
            }

            resolve(groupedData);
          },
          (tx, error) => {
            logError(`${FILE_PATH} - fetchTripsGroupedByMonth - Error fetching trips grouped by month`, error);
            reject(error);
            return false;
          }
        );
      });
    });
  } catch (error) {
    logError(`${FILE_PATH} - fetchTripsGroupedByMonth - General error`, error);
    throw error;
  }
};

export const fetchAllTrips = async (): Promise<Trip[]> => {
  try {
    console.log(`${FILE_PATH} - fetchAllTrips - Fetching all trips`);
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM trips ORDER BY distance DESC, (end_time - start_time) ASC',
          [],
          async (_, { rows }) => {
            const trips = rows._array;
            const allTrips: Trip[] = await Promise.all(
              trips.map(async (row: TripData) => {
                const trackPoints = await fetchTrackingPoints(row.id);                
                const flaggedTimestamps = await fetchFlaggedTimestamps(row.id); 

                console.log('trip found with id:', row.id, 'and start time:', new Date(row.start_time), 'and end time:', new Date(row.end_time));
                
                return {
                  id: row.id,
                  startTime: row.start_time,
                  endTime: row.end_time,
                  distance: row.distance,
                  duration: row.duration,
                  maxSpeed: row.max_speed,
                  elevationGainBarometer: row.elevation_gain_barometer,
                  elevationGainLocation: row.elevation_gain_location,
                  caloriesBurned: row.calories_burned,
                  rotationAngle: row.rotation_angle,
                  routeDimensions: {
                    width: row.route_width,
                    height: row.route_height,
                  },
                  mapCenter: row.map_center_latitude && row.map_center_longitude
                    ? { latitude: row.map_center_latitude, longitude: row.map_center_longitude }
                    : null, 
                  mapAltitude: row.map_altitude,
                  trackPoints,
                  flaggedTimestamps, 
                };
              })
            );
            resolve(allTrips);
          },
          (tx, error) => {
            logError(`${FILE_PATH} - fetchAllTrips - Error fetching trips`, error);
            reject(error);
            return false;
          }
        );
      });
    });
  } catch (error) {
    logError(`${FILE_PATH} - fetchAllTrips - General error`, error);
    throw error;
  }
};


export const fetchTrackingPoints = async (tripId: string): Promise<TrackingPoint[]> => {
  try {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql('SELECT * FROM tracking_points WHERE trip_id = ?;', [tripId],
          (_, { rows }) => {
            resolve(rows._array);
          },
          (tx, error) => {
            logError(`${FILE_PATH} - fetchTrackingPoints - Error fetching tracking points`, error);
            reject(error);
            return false;
          });
      });
    });
  } catch (error) {
    logError(`${FILE_PATH} - fetchTrackingPoints - General error`, error);
    throw error;
  }
};


export const fetchFlaggedTimestamps = async (tripId: string): Promise<FlaggedTimestamp[]> => {
  try {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT timestamp, latitude, longitude FROM flagged_timestamps WHERE trip_id = ? ORDER BY timestamp ASC;',
          [tripId],
          (_, { rows }) => {
            const timestamps = rows._array.map(row => ({
              timestamp: row.timestamp,
              latitude: row.latitude,
              longitude: row.longitude,
            }));
            resolve(timestamps);
          },
          (tx, error) => {
            logError(`${FILE_PATH} - fetchFlaggedTimestamps - Error fetching flagged timestamps`, error);
            reject(error);
            return false;
          }
        );
      });
    });
  } catch (error) {
    logError(`${FILE_PATH} - fetchFlaggedTimestamps - General error`, error);
    throw error;
  }
};


export const insertOrUpdateTrip = async (
  id: string,
  startTime: number,
  endTime: number,
  distance: number,
  duration: number,
  maxSpeed: number,
  elevationGainBarometer: number,
  elevationGainLocation: number,
  caloriesBurned: number
): Promise<void> => {
  try {
    db.transaction(tx => {
      // Check if the trip exists
      tx.executeSql(
        'SELECT id FROM trips WHERE id = ?;',
        [id],
        (_, { rows }) => {
          if (rows.length > 0) {
            // Trip exists, update it
            tx.executeSql(
              `UPDATE trips 
              SET start_time = ?, end_time = ?, distance = ?, duration = ?, 
                  max_speed = ?, elevation_gain_barometer = ?, elevation_gain_location = ?, calories_burned = ?
              WHERE id = ?;`,
              [
                startTime,
                endTime,
                distance,
                duration,
                maxSpeed,
                elevationGainBarometer,
                elevationGainLocation,
                caloriesBurned,
                id
              ],
              () => logMessage(`${FILE_PATH} - insertOrUpdateTrip - Trip updated with ID: ${id}`),
              (tx, error) => {
                logError(`${FILE_PATH} - insertOrUpdateTrip - Error updating trip`, error);
                return false;
              }
            );
          } else {
            // Trip doesn't exist, insert it
            tx.executeSql(
              `INSERT INTO trips 
              (id, start_time, end_time, distance, duration, max_speed, elevation_gain_barometer, elevation_gain_location, calories_burned) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
              [
                id,
                startTime,
                endTime,
                distance,
                duration,
                maxSpeed,
                elevationGainBarometer,
                elevationGainLocation,
                caloriesBurned
              ],
              () => logMessage(`${FILE_PATH} - insertOrUpdateTrip - Trip inserted with ID: ${id}`),
              (tx, error) => {
                logError(`${FILE_PATH} - insertOrUpdateTrip - Error inserting trip`, error);
                return false;
              }
            );
          }
        },
        (tx, error) => {
          logError(`${FILE_PATH} - insertOrUpdateTrip - Error checking trip existence`, error);
          return false;
        }
      );
    });
  } catch (error) {
    logError(`${FILE_PATH} - insertOrUpdateTrip - General error`, error);
    throw error;
  }
};

export const insertOrUpdateTrackingPoint = async (
  id: number | null,
  tripId: string,
  timestamp: number,
  latitude: number,
  longitude: number,
  speed: number,
  maxSpeed: number,
  avgSpeed: number,
  altitudeBarometer: number,
  altitudeLocation: number,
  barometricPressure: number
): Promise<void> => {
  try {
    db.transaction(tx => {
      // Check if the tracking point exists
      tx.executeSql(
        'SELECT id FROM tracking_points WHERE id = ?;',
        [id],
        (_, { rows }) => {
          if (rows.length > 0) {
            // Tracking point exists, update it
            tx.executeSql(
              `UPDATE tracking_points 
              SET trip_id = ?, timestamp = ?, latitude = ?, longitude = ?, 
                  speed = ?, max_speed = ?, avg_speed = ?, altitude_barometer = ?, altitude_location = ?, barometric_pressure = ? 
              WHERE id = ?;`,
              [
                tripId,
                timestamp,
                latitude,
                longitude,
                speed,
                maxSpeed,
                avgSpeed,
                altitudeBarometer,
                altitudeLocation,
                barometricPressure,
                id
              ],
              () => logMessage(`${FILE_PATH} - insertOrUpdateTrackingPoint - Tracking point updated with ID: ${id}`),
              (tx, error) => {
                logError(`${FILE_PATH} - insertOrUpdateTrackingPoint - Error updating tracking point`, error);
                return false;
              }
            );
          } else {
            // Tracking point doesn't exist, insert it
            tx.executeSql(
              `INSERT INTO tracking_points 
              (trip_id, timestamp, latitude, longitude, speed, max_speed, avg_speed, altitude_barometer, altitude_location, barometric_pressure) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
              [
                tripId,
                timestamp,
                latitude,
                longitude,
                speed,
                maxSpeed,
                avgSpeed,
                altitudeBarometer,
                altitudeLocation,
                barometricPressure
              ],
              () => logMessage(`${FILE_PATH} - insertOrUpdateTrackingPoint - Tracking point inserted`),
              (tx, error) => {
                logError(`${FILE_PATH} - insertOrUpdateTrackingPoint - Error inserting tracking point`, error);
                return false;
              }
            );
          }
        },
        (tx, error) => {
          logError(`${FILE_PATH} - insertOrUpdateTrackingPoint - Error checking tracking point existence`, error);
          return false;
        }
      );
    });
  } catch (error) {
    logError(`${FILE_PATH} - insertOrUpdateTrackingPoint - General error`, error);
    throw error;
  }
};


export const clearRotationAndMapCenterForAllTrips = async (): Promise<void> => {
  try {
    db.transaction(tx => {
      tx.executeSql(
        'UPDATE trips SET rotation_angle = NULL, map_center_latitude = NULL, map_center_longitude = NULL, map_altitude = NULL;',
        [],
        () => {
          logMessage(`${FILE_PATH} - clearRotationAndMapCenterForAllTrips - Cleared rotation and map center for all trips.`);
        },
        (tx, error) => {
          logError(`${FILE_PATH} - clearRotationAndMapCenterForAllTrips - Error clearing rotation and map center`, error);
          return false;
        }
      );
    });
  } catch (error) {
    logError(`${FILE_PATH} - clearRotationAndMapCenterForAllTrips - General error`, error);
    throw error;
  }
};


