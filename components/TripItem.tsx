// components/TripItem.tsx
import React, { useRef, useEffect, memo } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import Text from '@/components/Text'; 
import MapView, { Polyline, Marker, Camera, Polygon } from 'react-native-maps';
import { useOrientation } from '../context/OrientationContext';
import { format } from 'date-fns';
import chroma from 'chroma-js';
import { Ionicons } from '@expo/vector-icons';
import { FlaggedTimestamp } from '@/types';
import { updateRouteSettings } from '@/database';
import { useSettings } from '@/context/SettingsContext';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface TrackPoint {
  latitude: number;
  longitude: number;
  speed: number;
}

const FILE_PATH = 'components/TripItem.tsx';

const DEFAULT_LATITUDE = 50;
const DEFAULT_LONGITUDE = -95;
const MIN_DISTANCE = 0.1; // Approximately 100 meters

const calculateBoundingBox = (coordinates: Coordinate[]): BoundingBox => {
  const boundingBox = coordinates.reduce(
    (acc, { latitude, longitude }) => ({
      minLat: Math.min(acc.minLat, latitude),
      maxLat: Math.max(acc.maxLat, latitude),
      minLon: Math.min(acc.minLon, longitude),
      maxLon: Math.max(acc.maxLon, longitude),
    }),
    { minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity }
  );
  return boundingBox;
};

// Convert lat/lon to Web Mercator projection for rotation
const toWebMercator = ({ latitude, longitude }: Coordinate) => {
  const x = (longitude * 20037508.34) / 180;
  let y = Math.log(Math.tan((90 + latitude) * Math.PI / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return { x, y };
};

// Convert Web Mercator back to lat/lon
const toLatLon = ({ x, y }: { x: number; y: number }) => {
  const longitude = (x / 20037508.34) * 180;
  let latitude = (y / 20037508.34) * 180;
  latitude = (180 / Math.PI) * (2 * Math.atan(Math.exp(latitude * Math.PI / 180)) - Math.PI / 2);
  return { latitude, longitude };
};

const rotateCoordinate = (coordinate: Coordinate, angle: number, center: Coordinate): Coordinate => {
  const centerCartesian = toWebMercator(center);
  const coordCartesian = toWebMercator(coordinate);

  const rad = (Math.PI / 180) * angle;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const translatedX = coordCartesian.x - centerCartesian.x;
  const translatedY = coordCartesian.y - centerCartesian.y;

  const rotatedX = translatedX * cos - translatedY * sin;
  const rotatedY = translatedX * sin + translatedY * cos;

  const rotatedCartesian = {
    x: rotatedX + centerCartesian.x,
    y: rotatedY + centerCartesian.y,
  };

  return toLatLon(rotatedCartesian);
};

const TripItem = ({ trip, colorScheme, isVisible }: { trip: any, colorScheme: 'dark' | 'light', isVisible: boolean }) => {
  const { settings } = useSettings();
  const { orientation, isLandscape, adjustedInsets } = useOrientation();
  const unit = settings.unit!;
  const mapRef = useRef<MapView | null>(null);

  const setupMapCamera = () => {
    let mapWidth;
    let mapHeight;
    
    if (isLandscape) {
      mapWidth = Dimensions.get('window').width - 80 - adjustedInsets.right - adjustedInsets.left;
      mapHeight = Dimensions.get('window').height * 0.5;
    } else {
      mapWidth = Dimensions.get('window').width;
      mapHeight = Dimensions.get('window').width * 0.3;
    }

    const mapAspectRatio = mapWidth / mapHeight;
    console.log('mapAspectRatio', mapAspectRatio);
    let camera: Camera = {
      center: {
        latitude: DEFAULT_LATITUDE,
        longitude: DEFAULT_LONGITUDE,
      },
      heading: 0,
      pitch: 0,
      zoom: 1,
      altitude: 15000000, 
    };

    let smallestBoundingBox: BoundingBox | null = null;
    let bestBoundingBox: BoundingBox | null = null;
    let smallestAngle = 0;
    let bestAngle = 0;
    let rotationAngle = trip.rotationAngle;
    let mapCenter = trip.mapCenter;
    let routeWidth = trip.routeDimensions?.width;
    let routeHeight = trip.routeDimensions?.height;
    let bestWidth;
    let bestHeight;
    let smallestAspectRatioDiff = Infinity;
    let smallestSide = Infinity;
    let rotatedBoundingBoxCoordinates: Coordinate[] = [];

    console.log('trip.distance', trip.distance);
    console.log('min distance', MIN_DISTANCE); 
    console.log('trip.trackPoints.length', trip.trackPoints.length);

    if (trip.distance > MIN_DISTANCE && trip.trackPoints.length > 1) {
      const coordinates = trip.trackPoints.map((point: TrackPoint): Coordinate => ({
        latitude: point.latitude,
        longitude: point.longitude,
      }));

      const center: Coordinate = {
        latitude: (Math.max(...coordinates.map((c: Coordinate) => c.latitude)) + Math.min(...coordinates.map((c: Coordinate) => c.latitude))) / 2,
        longitude: (Math.max(...coordinates.map((c: Coordinate) => c.longitude)) + Math.min(...coordinates.map((c: Coordinate) => c.longitude))) / 2,
      };

      console.log('mapCenter', mapCenter);
      console.log('routeWidth', routeWidth);
      console.log('routeHeight', routeHeight);

      if (!mapCenter || !routeWidth || !routeHeight) {
        console.log('!mapCenter || !routeWidth || !routeHeight');
        
        for (let angle = 0; angle <= 90; angle += 1) {
          const rotatedCoordinates = coordinates.map((coordinate: Coordinate) =>
            rotateCoordinate(coordinate, angle, center)
          );
          const boundingBox = calculateBoundingBox(rotatedCoordinates);

          const width = boundingBox.maxLon - boundingBox.minLon;
          const height = boundingBox.maxLat - boundingBox.minLat;
          const area = width * height;

          let aspectRatio;

          if (width > height) {
            aspectRatio = width / height;
          } else {
            aspectRatio = height / width;
          }

          
          const aspectRatioDiff = Math.abs(aspectRatio - mapAspectRatio);

          if (aspectRatioDiff < smallestAspectRatioDiff) {
            smallestAspectRatioDiff = aspectRatioDiff;
            bestAngle = angle;
            if (height <= width) {
              rotationAngle = angle; // Portrait mode
            } else {
              rotationAngle = angle - 90; // Landscape mode correction
            }
            bestHeight = height;
            bestWidth = width;
            bestBoundingBox = boundingBox;
          }

        }
      
        if (bestBoundingBox) {
          const boundingBoxCenter: Coordinate = {
            latitude: (bestBoundingBox.maxLat + bestBoundingBox.minLat) / 2,
            longitude: (bestBoundingBox.maxLon + bestBoundingBox.minLon) / 2,
          };

          const boundingBoxCoordinates = [
            { latitude: bestBoundingBox.minLat, longitude: bestBoundingBox.minLon },
            { latitude: bestBoundingBox.maxLat, longitude: bestBoundingBox.minLon },
            { latitude: bestBoundingBox.maxLat, longitude: bestBoundingBox.maxLon },
            { latitude: bestBoundingBox.minLat, longitude: bestBoundingBox.maxLon },
          ];

          rotatedBoundingBoxCoordinates = boundingBoxCoordinates.map((coordinate) =>
            rotateCoordinate(coordinate, -bestAngle, center)
          );

          const rotatedBoundingBox = calculateBoundingBox(rotatedBoundingBoxCoordinates);

          const rotatedBoundingBoxCenter: Coordinate = {
            latitude: (rotatedBoundingBox.maxLat + rotatedBoundingBox.minLat) / 2,
            longitude: (rotatedBoundingBox.maxLon + rotatedBoundingBox.minLon) / 2,
          };

          mapCenter = rotatedBoundingBoxCenter;

          routeWidth = bestBoundingBox.maxLon - bestBoundingBox.minLon;
          routeHeight = bestBoundingBox.maxLat - bestBoundingBox.minLat;
        }

        if (mapCenter) {
          updateRouteSettings(trip.id, rotationAngle, routeWidth, routeHeight, mapCenter);
        }
      } 
      const altitude = calculateAltitude(routeWidth, routeHeight, mapWidth, mapHeight);

      console.log('rotationAngle', rotationAngle);
      console.log('altitude', altitude);
      camera = {
        center: mapCenter,
        heading: rotationAngle,
        pitch: 0,
        zoom: 1,
        altitude,
      };
    } else if (trip.trackPoints.length > 0) {
      console.log('trip.trackPoints.length > 0');
      const singlePoint = trip.trackPoints[0];
      camera = {
        center: {
          latitude: singlePoint.latitude,
          longitude: singlePoint.longitude,
        },
        heading: 0,
        pitch: 0,
        zoom: 1,
        altitude: 1000,
      };
    }

    if (mapRef.current) {
      console.log('mapRef.current.setCamera(camera)', camera);
      mapRef.current.setCamera(camera);
    }

    return { bestBoundingBox, rotatedBoundingBoxCoordinates };
  };

  useEffect(() => {
    if (isVisible) {
      setupMapCamera();
    }
  }, [trip.trackPoints, isVisible, orientation]);

  useEffect(() => {
    if (isVisible && mapRef.current && trip.trackPoints.length > 0 && Platform.OS === 'android') {
      //mapRef.current.animateToRegion({
      //  latitude: trip.mapCenter.latitude,
      //  longitude: trip.mapCenter.longitude,
      //  latitudeDelta: 0.02,  // Adjust as necessary for better zoom
      //  longitudeDelta: 0.02,        
      //}, 1000);

      //mapRef.current.fitToCoordinates(trip.trackPoints, {
      //});

      mapRef.current.setCamera({
        center: trip.mapCenter,
        heading: trip.rotationAngle, 
        pitch: 0,
        zoom: 12,
        altitude: 1000
      });
     
    }
  }, [isVisible, trip.trackPoints]);

 
  
  
  

  const renderBoundingBox = (boundingBox: BoundingBox, color: string) => {
    const coordinates = [
      { latitude: boundingBox.minLat, longitude: boundingBox.minLon },
      { latitude: boundingBox.maxLat, longitude: boundingBox.minLon },
      { latitude: boundingBox.maxLat, longitude: boundingBox.maxLon },
      { latitude: boundingBox.minLat, longitude: boundingBox.maxLon },
    ];

    return (
      <Polygon
        coordinates={coordinates}
        strokeColor={color}
        fillColor={`${color}`} // Add transparency to the fill color
        strokeWidth={2}
      />
    );
  };

  const renderRotatedBoundingBox = (coordinates: Coordinate[], color: string) => {
    return (
      <Polygon
        coordinates={coordinates}
        strokeColor={color}
        fillColor={`${color}`} // Add transparency to the fill color
        strokeWidth={2}
      />
    );
  };

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h === 0) {
      return [m, s].map(v => (v < 10 ? `0${v}` : v)).join(':');
    } else {
      return [h, m, s].map(v => (v < 10 ? `0${v}` : v)).join(':');
    }
  };

  const formatDayTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return format(date, 'EEE hh:mm a');
  };

  const convertDistance = (distance: number | null, unit: string) => {
    if (distance === null) return '0.00';
    return unit === 'Imperial' ? (distance * 0.621371).toFixed(1) : distance.toFixed(1);
  };

  const convertSpeed = (speed: number | null, unit: string) => {
    if (speed === null) return '0.0';
    return unit === 'Imperial' ? (speed * 0.621371).toFixed(1) : speed.toFixed(1);
  };

  const calculateAverageSpeed = (distance: number, duration: number): number => {
    if (duration === 0) return 0;
    return distance / (duration / 3600); // Returns speed in km/h
  };

  const getColorForSpeed = (speed: number, minSpeed: number, maxSpeed: number) => {
    const gradientColors = ['#ab0000', '#FFA700', '#FFFF00', '#0cba00']; // Red -> Orange -> Yellow -> Green
    const scale = chroma.scale(gradientColors).domain([minSpeed, maxSpeed]);
    return scale(speed).hex();
  };

  const calculateAltitude = (routeWidth: number, routeHeight: number, mapWidth: number, mapHeight: number): number => {
    const earthCircumference = 40075017; // Earth's circumference in meters for Web Mercator projection
   
    // Width and height of the bounding box in degrees
    
    let mapAspectRatio;
    if (routeWidth < routeHeight) {
      mapAspectRatio = mapWidth / mapHeight;
    } else {
      mapAspectRatio = mapHeight / mapWidth
    }
      
    // Convert the width and height of the bounding box to meters using the Web Mercator projection
    const widthInMeters = (routeWidth * earthCircumference) / 360;
    const heightInMeters = (routeHeight * earthCircumference) / 360;

    // Calculate altitude required to fit the bounding box width and height into the map view

    let altitudeForWidth;
    let altitudeForHeight;
    let minAltitude;
    if (isLandscape) {
      altitudeForWidth = widthInMeters / (mapWidth / 200);
      altitudeForHeight = heightInMeters / (mapHeight / 110);
      minAltitude = 800;
    } else {
      altitudeForWidth = widthInMeters / (mapWidth / 400);
      altitudeForHeight = heightInMeters / (mapHeight / 70);
      minAltitude = 500;
    } 

    // Use the higher altitude to ensure both dimensions fit within the view
    const altitude = Math.max(altitudeForWidth, altitudeForHeight);

    return Math.max(altitude, minAltitude);
  };

  const calculateAltitudeForBoundingBox = (boundingBox: BoundingBox, mapWidth: number, mapHeight: number): number => {
    const earthCircumference = 40075017; // Earth's circumference in meters for Web Mercator projection
   
    // Width and height of the bounding box in degrees
    const dx = boundingBox.maxLon - boundingBox.minLon;
    const dy = boundingBox.maxLat - boundingBox.minLat;

    let mapAspectRatio;
    if (dx < dy) {
      mapAspectRatio = mapWidth / mapHeight;
    } else {
      mapAspectRatio = mapHeight / mapWidth
    }
      

    // Convert the width and height of the bounding box to meters using the Web Mercator projection
    const widthInMeters = (dx * earthCircumference) / 360;
    const heightInMeters = (dy * earthCircumference) / 360;

    // Calculate altitude required to fit the bounding box width and height into the map view

    let altitudeForWidth;
    let altitudeForHeight;
    let minAltitude;
    if (isLandscape) {
      altitudeForWidth = widthInMeters / (mapWidth / 200);
      altitudeForHeight = heightInMeters / (mapHeight / 110);
      minAltitude = 800;
    } else {
      altitudeForWidth = widthInMeters / (mapWidth / 400);
      altitudeForHeight = heightInMeters / (mapHeight / 70);
      minAltitude = 500;
    } 

    // Use the higher altitude to ensure both dimensions fit within the view
    const altitude = Math.max(altitudeForWidth, altitudeForHeight);

    return Math.max(altitude, minAltitude);
  };



  const renderPolyline = () => {
    if (!trip || !trip.trackPoints || !isVisible) {
      return null;
    }

    const maxRenderPoints = 40;
    const totalPoints = trip.trackPoints.length;
    const interval = Math.ceil(totalPoints / maxRenderPoints);

    const downsampledPoints: TrackPoint[] = trip.trackPoints.filter((_: TrackPoint, index: number) => index % interval === 0);
    const speeds: number[] = downsampledPoints.map((point: TrackPoint) => point.speed);
    const minSpeed: number = Math.min(...speeds);
    const maxSpeed: number = Math.max(...speeds);

    return downsampledPoints.map((point: TrackPoint, index: number) => {
      if (index === downsampledPoints.length - 1) return null;
      const nextPoint: TrackPoint = downsampledPoints[index + 1];
      const color: string = getColorForSpeed((point.speed + nextPoint.speed) / 2, minSpeed, maxSpeed); // Average speed for smoother transition

      return (
        <Polyline
          key={`polyline-${index}`}
          coordinates={[
            { latitude: point.latitude, longitude: point.longitude },
            { latitude: nextPoint.latitude, longitude: nextPoint.longitude },
          ]}
          strokeWidth={7}
          strokeColor={color}
        />
      );
    });
  };

  const renderFlags = () => {
    if (!trip.flaggedTimestamps || trip.flaggedTimestamps.length === 0 || !isVisible) {
      return null;
    }
    return trip.flaggedTimestamps.map((flag: FlaggedTimestamp, index: number) => (
      <Marker
        key={`flag-${index}`}
        coordinate={{ latitude: flag.latitude, longitude: flag.longitude }}
      >
        <Ionicons name="flag" size={32} color="#FF4500" />
      </Marker>
    ));
  };

  const boundingBoxData = setupMapCamera();

  return (
    <View style={[styles.tripContainer, colorScheme === 'dark' ? styles.darkBackground : styles.lightBackground]}>
     
      <View style={styles.tripHeader}>
        <Text style={[styles.tripStats, colorScheme === 'dark' ? styles.darkText : styles.lightText]}
            >
          {`${formatDuration(trip.duration)} | ${convertDistance(trip.distance, unit)} ${unit === 'Metric' ? 'km' : 'mi'} | ${convertSpeed(calculateAverageSpeed(trip.distance, trip.duration), unit)} ${unit === 'Metric' ? 'km/h' : 'mph'}`}
        </Text>
        <Text style={[styles.tripTime, colorScheme === 'dark' ? styles.darkText : styles.lightText]}
            >
          {formatDayTime(trip.startTime)}
        </Text>
      </View>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={[
            styles.map,
            {
              height: isLandscape
                ? Dimensions.get('window').height * 0.5
                : Dimensions.get('window').width * 0.3,
              width: isLandscape
                ? Dimensions.get('window').width - 80 - adjustedInsets.right - adjustedInsets.left 
                : '100%',
            },
          ]}
          mapType="standard"
          userInterfaceStyle="dark"
          customMapStyle={darkMapStyle}
          initialCamera={{
            center: {
              latitude: trip.trackPoints.length > 0 ? trip.trackPoints[0].latitude : DEFAULT_LATITUDE,
              longitude: trip.trackPoints.length > 0 ? trip.trackPoints[0].longitude : DEFAULT_LONGITUDE,
            },
            heading: 0,
            pitch: 0,
            zoom: 1,
            altitude: 15000000,
          }}

          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          
        >
          {renderPolyline()}
          {renderFlags()}
          
          {boundingBoxData.bestBoundingBox && renderBoundingBox(boundingBoxData.bestBoundingBox, 'rgba(255,0,0,0.4)')}
          {boundingBoxData.rotatedBoundingBoxCoordinates.length > 0 &&
            renderRotatedBoundingBox(boundingBoxData.rotatedBoundingBoxCoordinates, 'rgba(0,255,0,0.5)')}

        </MapView>
      </View>
      
    </View>
  );
};

const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "administrative.country",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#2c2c2c"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#8a8a8a"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#373737"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#3c3c3c"
      }
    ]
  },
  {
    "featureType": "road.highway.controlled_access",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#4e4e4e"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "transit",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#000000"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#3d3d3d"
      }
    ]
  }
];

const styles = StyleSheet.create({
  tripContainer: {
    width: '100%',
    paddingVertical: 0,
  },
  darkBackground: {
    backgroundColor: '#000',
  },
  lightBackground: {
    backgroundColor: '#fff',
  },
  darkText: {
    color: '#fff',
  },
  lightText: {
    color: '#000',
  },
  mapContainer: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    width: '100%',
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripStats: {
    fontSize: 18,
    paddingVertical: 5,
  },
  tripTime: {
    fontSize: 18,
    textAlign: 'right',
    marginRight: 0,
  },
});

export default memo(TripItem);
