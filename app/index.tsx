// app/trips.tsx
import React, { useState, useEffect, useCallback, memo, Fragment } from 'react';
import { View, StyleSheet, TouchableOpacity, SectionList, Alert, StatusBar, FlatList, ViewToken, ActivityIndicator, Modal, TouchableWithoutFeedback, Platform,} from 'react-native';
import { useRouter } from 'expo-router';
import Text from '@/components/Text'; 
import { DrawerActions, useNavigation, useFocusEffect, useTheme, DarkTheme } from '@react-navigation/native';
import { Trip } from '@/types';
import { Ionicons  } from '@expo/vector-icons';
import BottomNavBar from '@/components/BottomNavBar';
import { format, parseISO } from 'date-fns';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { useTrips } from '../context/TripsContext';
import { useExpandedState } from '@/context/ExpandedStateContext';
import { useSettings } from '@/context/SettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logMessage, logError } from '../utils/logger';
import TripItem from '../components/TripItem';
import { deleteTrip } from '@/database';
import { useOrientation } from '../context/OrientationContext';
import { Swipeable } from 'react-native-gesture-handler';


const FILE_PATH = 'app/trips.tsx';

interface SectionData {
  title: string;
  data: {
    date: string;
    trips: Trip[];
  }[];
}

const TripListScreen: React.FC = () => {
  const { colors } = useTheme();
  const colorScheme = colors.background === DarkTheme.colors.background ? 'dark' : 'light';
  const { adjustedInsets, isLandscape, orientation } = useOrientation();
  const navigation = useNavigation();

  const router = useRouter();
  const { groupedTrips, loading, tripsByDistance, deleteTripFromState } = useTrips();

  const handleMenuPress = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const { expandedMonths, setExpandedMonths, expandedDates, setExpandedDates } = useExpandedState();
  const { isAdvanced } = useAdvancedMode();
  const { settings } = useSettings();
  const unit = settings.unit!;
  const [selectedOption, setSelectedOption] = useState<'Date' | 'Dist'>('Date');

  const [visibleItemsMap, setVisibleItemsMap] = useState<Record<string, boolean>>({});
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<{ tripId: string; startTime: number; endTime: number } | null>(null);


  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle(colorScheme === 'dark' ? 'light-content' : 'dark-content');
    }, [colorScheme])
  );

  useEffect(() => {
    if (groupedTrips.length > 0) {
      setMostRecentMonthExpanded();
    }
  }, [groupedTrips]);

  const setMostRecentMonthExpanded = async () => {
    const mostRecentMonth = groupedTrips[0]?.month;
    if (mostRecentMonth) {
      const newExpandedMonths = [mostRecentMonth];
      const newExpandedDates = groupedTrips[0].data.map(dateGroup => dateGroup.date);

      setExpandedMonths(newExpandedMonths);
      setExpandedDates(newExpandedDates);
      saveExpandedStateToStorage(newExpandedMonths, newExpandedDates);
    }
  };

  const saveExpandedStateToStorage = async (months: string[], dates: string[]) => {
    try {
      await AsyncStorage.setItem('expandedMonths', JSON.stringify(months));
      await AsyncStorage.setItem('expandedDates', JSON.stringify(dates));
    } catch (error) {
      logError(`${FILE_PATH} - saveExpandedStateToStorage - Error saving expanded state to storage`, error);
    }
  };

 
  const saveSortingOptionToStorage = async (option: 'Date' | 'Dist') => {
    try {
      logMessage(`${FILE_PATH} - saveSortingOptionToStorage - Saving sorting option to storage`);
      await AsyncStorage.setItem('sortingOption', option);
    } catch (error) {
      logError(`${FILE_PATH} - saveSortingOptionToStorage - Error saving sorting option to storage`, error);
    }
  };

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => {
      const isExpanded = prev.includes(month);
      let newExpandedMonths = isExpanded ? prev.filter(m => m !== month) : [...prev, month];
  
      // Automatically collapse all dates under this month if it's being collapsed
      let newExpandedDates = expandedDates;
      if (isExpanded) {
        const monthData = groupedTrips.find(group => group.month === month);
        if (monthData) {
          const datesToCollapse = monthData.data.map(dateGroup => dateGroup.date);
          newExpandedDates = expandedDates.filter(date => !datesToCollapse.includes(date));
        }
      } else {
        // Expand all dates under this month if the month is being expanded
        const monthData = groupedTrips.find(group => group.month === month);
        if (monthData) {
          const datesToExpand = monthData.data.map(dateGroup => dateGroup.date);
          newExpandedDates = [...new Set([...expandedDates, ...datesToExpand])];
        }
      }
  
      setExpandedDates(newExpandedDates);
      saveExpandedStateToStorage(newExpandedMonths, newExpandedDates);
      return newExpandedMonths;
    });
  };
  
  
  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const newExpandedDates = prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date];
      saveExpandedStateToStorage(expandedMonths, newExpandedDates);
      return newExpandedDates;
    });
  };

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => (v < 10 ? `0${v}` : v)).join(':');
  };

  
  const handleDeleteTrip = async (tripId: string, startTime: number, endTime: number) => {
    try {
      logMessage(`${FILE_PATH} - handleDeleteTrip - Removing trip from state: ${tripId}`);
      deleteTripFromState(tripId);
      deleteTrip(tripId);
     
    } catch (error) {
      logError(`${FILE_PATH} - handleDeleteTrip - Error deleting trip`, error);
    } finally {
      setDeleteModalVisible(false);
    }
  };

  const confirmDelete = (tripId: string, startTime: number, endTime: number) => {
    console.log('confirmDelete');
    setSelectedTrip({ tripId, startTime, endTime });
    setDeleteModalVisible(true);
  };

  const renderRightActions = (trip: Trip) => (
    <View style={styles.deleteButtonContainer}>
      <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDelete(trip.id, trip.startTime, trip.endTime)}>
        <Ionicons name="trash" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  

  const convertDistance = (distance: number | null) => {
    try {
      if (distance === null) return '0.00';
      const convertedDistance = unit === 'Imperial' ? (distance * 0.621371).toFixed(1) : distance.toFixed(1);
      return convertedDistance;
    } catch (error) {
      logError(`${FILE_PATH} - convertDistance - Error converting distance`, error);
      return '0.00';
    }
  };

  const convertSpeed = (speed: number | null, unit: string) => {
    if (speed === null) return '0.0';
    return unit === 'Imperial' ? (speed * 0.621371).toFixed(1) : speed.toFixed(1);
  };


  const handleSortingOptionChange = (option: 'Date' | 'Dist') => {
    try {
      logMessage(`${FILE_PATH} - handleSortingOptionChange - Changing sorting option to: ${option}`);
      setSelectedOption(option);
      saveSortingOptionToStorage(option);
    } catch (error) {
      logError(`${FILE_PATH} - handleSortingOptionChange - Error changing sorting option`, error);
    }
  };

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const newVisibleItemsMap: Record<string, boolean> = {};

      viewableItems.forEach(({ item }) => {
        if (item.trips) {
          item.trips.forEach((trip: Trip) => {
            newVisibleItemsMap[trip.id] = true;
          });
        } else if (item.id) {
          newVisibleItemsMap[item.id] = true;
        }
      });

      setVisibleItemsMap(newVisibleItemsMap);
    },
    []
  );

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 15, // The minimum percentage of an item that must be visible for it to be considered visible
    minimumViewTime: 300,            // The minimum time (in milliseconds) an item must be visible
    //viewAreaCoveragePercentThreshold: 110, // Render more items above and below (150% coverage)
  };

  const renderTripItem = ({ item }: { item: Trip }) => (
    <Swipeable
      renderRightActions={() => renderRightActions(item)}
    >
      <TripItem
        trip={item}
        colorScheme={colorScheme}
        isVisible={!!visibleItemsMap[item.id]}
      />
    </Swipeable>
  );

  const renderSectionHeader = ({ section: { title, data } }: { section: SectionData }) => {
    const isMonthExpanded = expandedMonths.includes(title);

    // Calculate total duration, distance, and average speed for the month
    const totalDuration = data.reduce((monthSum, dateGroup) =>
      monthSum + dateGroup.trips.reduce((sum, trip) => sum + trip.duration, 0), 0);
    const totalDistance = data.reduce((monthSum, dateGroup) =>
      monthSum + dateGroup.trips.reduce((sum, trip) => sum + trip.distance, 0), 0);
    const averageSpeed = totalDistance / (totalDuration / 3600); // km/h or mi/h

    return (
      <TouchableOpacity onPress={() => toggleMonth(title)} style={styles.monthHeader}>
        <View style={styles.monthHeaderTextContainer}>
          <Text style={[styles.monthStats, colorScheme === 'dark' ? styles.darkText : styles.lightText, styles.paddedText]}
          numberOfLines={1}
          ellipsizeMode="clip"
            >
            {`${formatDuration(totalDuration)} | ${convertDistance(totalDistance)} ${unit === 'Metric' ? 'km' : 'mi'} | ${convertSpeed(averageSpeed, unit)} ${unit === 'Metric' ? 'km/h' : 'mph'}`}
          </Text>
          <Text style={[styles.monthText, colorScheme === 'dark' ? styles.darkText : styles.lightText, styles.paddedText]}
          numberOfLines={1}
          ellipsizeMode="clip"
            >
            {format(parseISO(title), 'MMM yyyy')}
          </Text>
        </View>
        <Ionicons name={isMonthExpanded ? 'chevron-up' : 'chevron-down'} style={[styles.chevron, colorScheme === 'dark' ? styles.darkText : styles.lightText]} />
      </TouchableOpacity>
    );
  };

  const getStyle = (orientation: any, adjustedInsets: any) => {
    //console.log('orientation', orientation);
    //console.log('adjustedInsets', adjustedInsets);
    if (orientation === 'landscape-left') {
      return { flex: 1, paddingRight: adjustedInsets.right + 80, paddingLeft: adjustedInsets.left };
    } else if (orientation === 'landscape-right') {
      return { flex: 1, paddingRight: adjustedInsets.right + 80, paddingLeft: adjustedInsets.left};
    } else {
      return { flex: 1, paddingTop: adjustedInsets.top};
    }
  };

  const renderDateGroup = ({ item, section }: { item: { date: string, trips: Trip[] }, section: SectionData }) => {
    const isMonthExpanded = expandedMonths.includes(section.title);
    const isDateExpanded = expandedDates.includes(item.date);
  
    if (!isMonthExpanded) {
      // If the month is not expanded, do not render any days or trips.
      return null;
    }
  
    return (
      <View style={styles.dateGroupContainer}>
        <TouchableOpacity onPress={() => toggleDate(item.date)} style={styles.dateHeader}>
          <View style={styles.dateHeaderTextContainer}>
            <Text style={[styles.dateStats, colorScheme === 'dark' ? styles.darkText : styles.lightText]}
            numberOfLines={1}
            ellipsizeMode="clip"
              >
              {`${formatDuration(item.trips.reduce((sum, trip) => sum + trip.duration, 0))} | ${convertDistance(item.trips.reduce((sum, trip) => sum + trip.distance, 0))} ${unit === 'Metric' ? 'km' : 'mi'} | ${convertSpeed(item.trips.reduce((sum, trip) => sum + trip.distance, 0) / (item.trips.reduce((sum, trip) => sum + trip.duration, 0) / 3600), unit)} ${unit === 'Metric' ? 'km/h' : 'mph'}`}
            </Text>
            <Text style={[styles.dateText, colorScheme === 'dark' ? styles.darkText : styles.lightText]}
            numberOfLines={1}
            ellipsizeMode="clip"
              >
              {format(parseISO(item.date), 'MMM dd')}
            </Text>
          </View>
          <Ionicons name={isDateExpanded ? 'chevron-up' : 'chevron-down'} size={30} color={colorScheme === 'dark' ? '#fff' : '#000'} />
        </TouchableOpacity>
        {isDateExpanded && (
          <View>
            {item.trips.map((trip) => (
              <Swipeable
                key={trip.id}
                renderRightActions={() => renderRightActions(trip)}
              >
                <TripItem
                  trip={trip}
                  colorScheme={colorScheme}
                  isVisible={!!visibleItemsMap[trip.id]}
                />
              </Swipeable>
            ))}
          </View>
        )}
      </View>
    );
  };


  return (
    <Fragment>    
      
      <View style={[styles.container, colorScheme === 'dark' ? styles.darkBackground : styles.lightBackground]}>
       
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

        <View style={[styles.headerContainer, { paddingRight: isLandscape ? adjustedInsets.right + 80 : 0 }, { marginTop: adjustedInsets.top, paddingLeft: adjustedInsets.left }]}>
          <TouchableOpacity onPress={handleMenuPress} style={styles.menuButton}>
            <Ionicons name="menu" size={34} color={colorScheme === 'dark' ? '#fff' : '#000'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>
            Trips
          </Text>
        </View>
        <View style={[getStyle(orientation, adjustedInsets)]}>
        { loading ? (
          <View style={styles.noTripsContainer}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00ff00" />
              <Text style={styles.loadingText}>Loading trips...</Text>
            </View>
          </View>

        )

          : groupedTrips.length === 0 ? (
            <View style={styles.noTripsContainer}>
              <Text style={[styles.noTripsText, colorScheme === 'dark' ? styles.darkText : styles.lightText]}>
                No trips yet
              </Text>
             
            </View>
        )
          : groupedTrips.length === 0 ? (
            <View style={styles.noRecordingsContainer}>
              <Text style={[styles.noRecordingsText, colorScheme === 'dark' ? styles.darkText : styles.lightText]}>
                No Trips yet
              </Text>
                          
            </View>
          ) : selectedOption === 'Date' ? (
            <SectionList
              contentContainerStyle={styles.listContainer}
              sections={groupedTrips.map(group => ({
                title: group.month,
                data: group.data.map(dateGroup => ({
                  ...dateGroup,
                  totalDuration: group.totalDuration,
                  totalDistance: group.totalDistance,
                })),
              }))}
              renderItem={renderDateGroup} // Renders the date groups and their trips
              renderSectionHeader={renderSectionHeader} // Renders the month headers
              keyExtractor={(item, index) => item.date + index}
              onViewableItemsChanged={handleViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              //showsVerticalScrollIndicator={false}
            />

          ) : (
            <FlatList
              data={tripsByDistance}
              renderItem={renderTripItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContainer}
              viewabilityConfig={viewabilityConfig}
              onViewableItemsChanged={handleViewableItemsChanged}
              //showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {isLandscape && Platform.OS === 'ios' &&(
          <View style={styles.bottomBlackBar} />
        )}
        
      </View>    
     
      {/* Bottom Navigation Bar */}
      <View style={isLandscape ? styles.sideNavContainer : styles.bottomNavContainer}>
      <BottomNavBar
        colorScheme={colorScheme}
        handleStartStop={() => { }}
      />
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
        supportedOrientations={['portrait', 'landscape']}
      >
        <TouchableWithoutFeedback onPress={() => setDeleteModalVisible(false)}>
          <View style={styles.modalContainer}>
            <TouchableWithoutFeedback>
              <View style={styles.modalView}>
                <Text style={styles.modalText}allowFontScaling={false} >
                  
                    "Are you sure you want to delete this trip? This is permanent and can't be undone."
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setDeleteModalVisible(false)}>
                    <Text style={styles.modalButtonText}allowFontScaling={false} >Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={() => handleDeleteTrip(selectedTrip?.tripId || '', selectedTrip?.startTime || 0, selectedTrip?.endTime || 0)}>
                    <Text style={styles.modalButtonText} allowFontScaling={false} >Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
     
    
    </Fragment>
    );
  };
  
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center the header content
    zIndex: 100,
    backgroundColor: '#000',
  },
  menuButton: {
    position: 'absolute', // Absolutely position the menu button
    left: 20, // Stick it to the left
    zIndex: 1, // Ensure it's above other elements
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  darkBackground: {
    backgroundColor: '#000',
  },
  lightBackground: {
    backgroundColor: '#fff',
  },
  bottomNavContainer: {
    //height: 40,
  },
  sideNavContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 80,
    justifyContent: 'center',
    backgroundColor: '#000',
    zIndex: 10,
  },
  bottomBlackBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: '#000',
  },
  darkText: {
    color: '#fff',
  },
  lightText: {
    color: '#000',
  },
  listContainer: {
    paddingBottom: 80,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#000', // You can change this color to whatever you prefer
    //paddingHorizontal: 10, // Optional: Add padding to the left and right
  },
  monthHeaderTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  monthStats: {
    fontSize: 18,
    //flexShrink: 1,  // Allows this text to shrink if necessary
    marginRight: 5,  // Add margin to separate from the date
  },
  dateGroupContainer: {
    //paddingHorizontal: 10,
    paddingBottom: 5,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dateHeaderTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 18,
    textAlign: 'right',
  },
  dateStats: {
    fontSize: 18,
    flexShrink: 1,
    marginRight: 10, 
  },
  chevron: {
    fontSize: 30,
    textAlign: 'center',
  },
  deleteButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    backgroundColor: '#FF3B30',
    height: '80%',
    marginTop: 33,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: '#FF3B30',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#000',
  },
  paddedText: {
    paddingLeft: 0,
    //paddingRight: 10,
  },
  noRecordingsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noRecordingsText: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 10,
    paddingTop: 10,
    paddingLeft: 20,
    paddingRight: 20,
  },
  noTripsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noTripsText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconAlign: {
    marginBottom: 20,
    paddingRight: 10,
    paddingLeft: 10,
  },
  arrowAlign: {
    alignSelf: 'center',
    marginLeft: -120,
  },
  iconAlignBasic: {
    marginBottom: -3,
  },
  arrowAlignBasic: {
    marginTop: 10,
    marginRight: -150,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: 320,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalText: {
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#d9534f',
  },
  cancelButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 26,
  },
 
  
});

export default memo(TripListScreen);