// context/TripsContext.tsx
import React, { createContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { fetchTripsGroupedByMonth, fetchAllTrips, insertTrip } from '../database';
import { GroupedTrip, Trip } from '../types';
import { logMessage, logError } from '../utils/logger';
import uuid from 'react-native-uuid';

const FILE_PATH = 'context/TripsContext.tsx';

interface TripsContextType {
  groupedTrips: GroupedTrip[];
  tripsByDistance: Trip[];
  loading: boolean;
  loadTrips: () => Promise<void>;
  findTripById: (id: string) => Trip | undefined;
  deleteTripFromState: (id: string) => void;
  tripId: string | null;
  setTripId: (id: string) => void;
  createNewTrip: (startTime: number) => Promise<string>; // Modify createNewTrip to only require startTime
  getCurrentTripId: () => string | null;
  addOrUpdateTripInState: (trip: Trip) => void;
}

const TripsContext = createContext<TripsContextType | undefined>(undefined);

export const TripsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  
  const [groupedTrips, setGroupedTrips] = useState<GroupedTrip[]>([]);
  const [tripsByDistance, setTripsByDistance] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);


  useEffect(() => {
    logMessage(`${FILE_PATH} - useEffect - Loading state changed to: ${loading}`);
  }, [loading]);
  
  const loadTrips = async () => {
    try {
      setLoading(true);
      logMessage(`${FILE_PATH} - loadTrips - Fetching grouped trips`);      
      const groupedTripsData = await fetchTripsGroupedByMonth();
      const tripsData = await fetchAllTrips();
  
      const normalizedGroupedTripsData = groupedTripsData.map(monthGroup => ({
        ...monthGroup,
        data: monthGroup.data.map(dateGroup => ({
          ...dateGroup,
          trips: dateGroup.trips
            .map(trip => ({
              ...trip,
              startTime: new Date(trip.startTime).getTime(),
              endTime: new Date(trip.endTime).getTime(),
            }))
            .filter(trip => trip.startTime && trip.endTime)
        })).filter(dateGroup => dateGroup.trips.length > 0)
      })).filter(monthGroup => monthGroup.data.length > 0);
  
      const normalizedTripsData = tripsData
        .map(trip => ({
          ...trip,
          startTime: new Date(trip.startTime).getTime(),
          endTime: new Date(trip.endTime).getTime(),
        }))
        .filter(trip => trip.startTime && trip.endTime);
  
      setGroupedTrips(normalizedGroupedTripsData);
      setTripsByDistance(normalizedTripsData);
      logMessage(`${FILE_PATH} - loadTrips - Loaded trips successfully`);
    } catch (error) {
      logError(`${FILE_PATH} - loadTrips - Error fetching trips`, error);
    } finally {
      setLoading(false);
    }
  };
  

  const findTripById = (id: string) => {
    try {
      logMessage(`${FILE_PATH} - findTripById - Finding trip by ID: ${id}`);
      const trip = tripsByDistance.find(trip => trip.id === id);
      
      return trip;
    } catch (error) {
      logError(`${FILE_PATH} - findTripById - Error finding trip by ID`, error);
      return undefined;
    }
  };

  const deleteTripFromState = (id: string) => {
    try {
      logMessage(`${FILE_PATH} - deleteTripFromState - Deleting trip with ID: ${id}`);
      setGroupedTrips(prev => prev.map(month => ({
        ...month,
        data: month.data.map(date => ({
          ...date,
          trips: date.trips.filter(trip => trip.id !== id),
        })).filter(date => date.trips.length > 0),
      })).filter(month => month.data.length > 0));
  
      setTripsByDistance(prev => prev.filter(trip => trip.id !== id));
      logMessage(`${FILE_PATH} - deleteTripFromState - Trip deleted successfully`);
    } catch (error) {
      logError(`${FILE_PATH} - deleteTripFromState - Error deleting trip`, error);
    }
  };

  const createNewTrip = async (startTime: number) => {
    try {
      const id = uuid.v4() as string;
      await insertTrip(id, startTime, startTime, 0, 0, 0, 0, 0, 0);
      setTripId(id);
      logMessage(`${FILE_PATH} - createNewTrip - Trip created with ID: ${id}`);
      return id;
    } catch (error) {
      logError(`${FILE_PATH} - createNewTrip - Error creating new trip`, error);
      throw error; // Re-throw the error to handle it appropriately where createNewTrip is called
    }
  };

  const getCurrentTripId = () => {
    return tripId;
  };

  const addOrUpdateTripInState = (trip: Trip) => {
    setGroupedTrips(prevGroupedTrips => {
      const month = new Date(trip.startTime).toISOString().substring(0, 7);
      const date = new Date(trip.startTime).toISOString().substring(0, 10);

      const monthGroupIndex = prevGroupedTrips.findIndex(group => group.month === month);

      if (monthGroupIndex >= 0) {
        const monthGroup = prevGroupedTrips[monthGroupIndex];
        const dateGroupIndex = monthGroup.data.findIndex(group => group.date === date);

        if (dateGroupIndex >= 0) {
          const dateGroup = monthGroup.data[dateGroupIndex];
          const existingTripIndex = dateGroup.trips.findIndex(t => t.id === trip.id);

          if (existingTripIndex >= 0) {
            dateGroup.trips[existingTripIndex] = trip;
          } else {
            dateGroup.trips.push(trip);
          }

          dateGroup.totalDuration += trip.duration;
          dateGroup.totalDistance += trip.distance;

        } else {
          monthGroup.data.push({
            date,
            totalDuration: trip.duration,
            totalDistance: trip.distance,
            trips: [trip],
          });
        }

        monthGroup.totalDuration += trip.duration;
        monthGroup.totalDistance += trip.distance;

      } else {
        prevGroupedTrips.push({
          month,
          totalDuration: trip.duration,
          totalDistance: trip.distance,
          data: [{
            date,
            totalDuration: trip.duration,
            totalDistance: trip.distance,
            trips: [trip],
          }],
        });
      }

      return [...prevGroupedTrips];
    });
  };

  useEffect(() => {
    try {
      logMessage(`${FILE_PATH} - useEffect - Initial load of trips`);
      loadTrips();
    } catch (error) {
      logError(`${FILE_PATH} - useEffect - Error in initial load of trips`, error);
    }
  }, []);

  const value = useMemo(() => ({
    groupedTrips, tripsByDistance, loading, loadTrips, findTripById, deleteTripFromState, tripId, setTripId, createNewTrip, getCurrentTripId, addOrUpdateTripInState
  }), [groupedTrips, tripsByDistance, tripId, loading]);

  return (
    <TripsContext.Provider value={value}>
      {children}
    </TripsContext.Provider>
  );
};

export const useTrips = () => {
  const context = React.useContext(TripsContext);
  if (!context) {
    throw new Error('useTrips must be used within a TripsProvider');
  }
  return context;
};
