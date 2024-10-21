// components/BottomNavBar.tsx
import React, { Fragment } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Text from '@/components/Text'; 
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useNavigation, DrawerActions, useNavigationState } from '@react-navigation/native';
import { useAdvancedMode } from '@/context/AdvancedModeContext';
import { useOrientation } from '@/context/OrientationContext';

interface BottomNavBarProps {
  colorScheme: 'light' | 'dark';
  handleStartStop: () => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({
  colorScheme,
  handleStartStop,
}) => {;
  const navigation = useNavigation();
  const { isAdvanced } = useAdvancedMode();

  const { isLandscape, adjustedInsets } = useOrientation();

  const effectiveColorScheme = colorScheme;
  const textColor = effectiveColorScheme === 'dark' ? 'white' : Colors[effectiveColorScheme].text;

  const currentRouteName = useNavigationState((state) => state.routes[state.index]?.name);

  const navigateToIndexIfNeeded = async (callback: () => void) => {
    console.log('navigateToIndexIfNeeded', callback);
    if (currentRouteName !== 'index') {
      console.log('Navigating to index');
      await navigation.dispatch(DrawerActions.jumpTo('index', {function: callback.toString()}));      
    } else {
      callback();
    }
  };

  const handleStartStopWrapper = async () => {
    await navigateToIndexIfNeeded(handleStartStop);
  };

 
  return (
    <Fragment>
      {isLandscape ? (
        <View style={[styles.sideNav, {paddingRight: adjustedInsets.right, marginLeft: -adjustedInsets.right}]}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigation.dispatch(DrawerActions.jumpTo('index'))}
            activeOpacity={0.6}
            hitSlop={{ top: 20, bottom: 20, left: 40, right: 60 }}
          >
            <Ionicons name="bicycle" size={40} color={textColor} />
            <Text style={[styles.navText, { color: textColor }]}  >Trips</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigation.dispatch(DrawerActions.jumpTo('data'))}
            activeOpacity={0.6}
            hitSlop={{ top: 20, bottom: 20, left: 40, right: 60 }}
          >
            <Ionicons name="settings" size={40} color={textColor} />
            <Text style={[styles.navText, { color: textColor }]}  >Data</Text>
          </TouchableOpacity>
         
        </View>
      ) : (
        <View style={[styles.bottomNav, { paddingBottom: adjustedInsets.bottom }]}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigation.dispatch(DrawerActions.jumpTo('index'))}
            activeOpacity={0.6}
          >
            <Ionicons name="bicycle" size={40} color={textColor} />
            <Text style={[styles.navText, { color: textColor }]}
              >Trips</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigation.dispatch(DrawerActions.jumpTo('data'))}
            activeOpacity={0.6}
            hitSlop={{ top: 20, bottom: 20, left: 40, right: 60 }}
          >
            <Ionicons name="settings" size={40} color={textColor} />
            <Text style={[styles.navText, { color: textColor }]}  >Data</Text>
          </TouchableOpacity>
         
        </View>
      )}
    </Fragment>
    
  );
};

const styles = StyleSheet.create({
  
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    verticalAlign: 'bottom',
    //marginBottom: 40,
    paddingVertical: 10,
    zIndex: 10,
    backgroundColor: '#000',
  },
  sideNav: {
    flexDirection: 'column',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 0,
    height: '100%',
    //backgroundColor: '#f00',
    zIndex: 1000,
    elevation: 1000,
  },
  navButton: {
    alignItems: 'center',
  },
  navText: {
    marginTop: 5,
    textAlign: 'center',
    fontSize: 16,
  },
});

export default BottomNavBar;
