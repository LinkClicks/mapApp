// types.ts
import { RouteProp } from '@react-navigation/native';

export interface TripVideo {
  file_name: string;
  thumbnail?: string;
  start_time: number;
  end_time: number;
}

export interface FlaggedTimestamp {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude?: number; // optional
}

export interface Trip {
  id: string;
  startTime: number;
  endTime: number;
  distance: number;
  duration: number;
  maxSpeed: number;
  elevationGainBarometer: number | null;
  elevationGainLocation: number | null;
  caloriesBurned: number | null;
  trackPoints: TrackingPoint[];
  flaggedTimestamps: FlaggedTimestamp[];
  rotationAngle: number | null; 
  routeDimensions: {
    width: number | null;
    height: number | null;
  } | null; // Allow routeDimensions to be nullable
  mapCenter: {
    latitude: number | null;
    longitude: number | null;
  } | null;
  mapAltitude: number | null;
}



export type TrackingPoint = {
  id: number;
  session_id: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  speed: number;
  max_speed: number;
  avg_speed: number;
  altitudeBarometer: number;
  altitudeLocation: number;
  barometric_pressure: number;
  heading?: number;
};


export type GroupedTrip = {
  month: string;
  data: {
    date: string;
    totalDuration: number;
    totalDistance: number;
    trips: Trip[];
  }[];
  totalDuration: number;
  totalDistance: number;
};

export type RootStackParamList = {
  TripListScreen: {
    groupedTrips?: GroupedTrip[];
    latestMonth?: string;
    latestDate?: string;
  };
  tripScreen: {
    trip: Trip;
  };
  tripStack: undefined;
  index: {
    showModal?: boolean;
    handleRecord?: boolean;
    startNewSession?: boolean;
    handleLogTripAndRecordVideo?: boolean;
  };
  SettingsScreen: undefined;
  trips: undefined;
  videoPlaybackScreen: {
    videoName: string;
  };
  recordings: undefined;
};

export type TripListScreenRouteProp = RouteProp<RootStackParamList, 'TripListScreen'>;
export type TripDetailScreenRouteProp = RouteProp<RootStackParamList, 'tripStack'>;

export type TrackingContextType = {
  isTracking: boolean;
  isRecording: boolean;
  startTracking: () => void;
  stopTracking: (callback?: () => void) => void;
  handleRecord: () => void;
  saveTrip: () => void;
  deleteTrip: () => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  resetReadings: () => void;
  speed: number;
  avgSpeed: number;
  maxSpeed: number;
  distance: number;
  duration: number;
  altitudBarometer: number;
  altitudeLocation: number;
  barometricPressure: number;
  elevationGainBarometer: number;
  elevationGainLocation: number;
};
