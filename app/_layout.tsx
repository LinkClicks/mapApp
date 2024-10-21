// app/_layout.tsx
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Drawer } from 'expo-router/drawer';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { StyleSheet, View, Text } from 'react-native';
import { SettingsProvider, SettingsContext } from '@/context/SettingsContext';
import { AdvancedModeProvider, useAdvancedMode } from '../context/AdvancedModeContext';
import { SnackbarProvider } from '@/context/SnackbarContext';
import { OrientationProvider, useOrientation} from '@/context/OrientationContext';
import { ExpandedStateProvider } from '../context/ExpandedStateContext';
import { TripsProvider } from '@/context/TripsContext';
import { initDB } from '@/database';
import CustomDrawerContent from '@/components/CustomDrawerContent';

const FILE_PATH = 'app/_layout.tsx';

function AppContent() {
  const { settings } = useContext(SettingsContext);
  const systemColorScheme = useSystemColorScheme();
  //const theme = settings.colorScheme === 'System'
  //  ? (systemColorScheme === 'dark' ? DarkTheme : DefaultTheme)
  //  : (settings.colorScheme === 'Dark' ? DarkTheme : DefaultTheme);
  const theme = DarkTheme;

  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  //const { dispatch } = useMeters();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await SplashScreen.preventAutoHideAsync();
        console.log("Initializing database...");
        await initDB(); // Initialize the database
       //await stopLocationUpdates(dispatch);
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        SplashScreen.hideAsync().catch((error) => {
          console.error("Error hiding splash screen:", error);
        });
      }
    };

    initializeApp().catch((error) => {
      console.error("Error in app initialization:", error);
    });
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={theme}>
      <AdvancedModeProvider>
        <SnackbarProvider>
            <ExpandedStateProvider>
              <TripsProvider>
                <CustomDrawer />
              </TripsProvider>
            </ExpandedStateProvider>
        </SnackbarProvider>
      </AdvancedModeProvider>
    </ThemeProvider>
  );
}

const CustomDrawer = () => {

  const { isAdvanced } = useAdvancedMode();
  const { isLandscape } = useOrientation();
  
  return (
    <Drawer drawerContent={CustomDrawerContent} screenOptions={{ 
      drawerItemStyle: drawerStyles.drawerItem,
      drawerLabelStyle: drawerStyles.drawerLabel,
      drawerStyle: {
        width: isLandscape ? '70%' : '80%',
      },
    }}>
    <Drawer.Screen 
      name="index" 
      options={{ 
        title: 'Home', 
        drawerLabel: 'Home',
        drawerIcon: ({ color, size }) => (
          <Ionicons name="home" size={size} color={color} />
        ),  
        headerShown: false, 
        swipeEdgeWidth: 0,
        drawerItemStyle: drawerStyles.drawerItem,
        drawerLabelStyle: drawerStyles.drawerLabel
      }} 
    />

    <Drawer.Screen 
      name="data" 
      options={{ 
        title: 'Data', 
        drawerLabel: 'Data',
        drawerIcon: ({ color, size }) => (
          <Ionicons name="settings" size={size} color={color} />
        ),  
        headerShown: false, 
        swipeEdgeWidth: 0,
        drawerItemStyle: drawerStyles.drawerItem,
        drawerLabelStyle: drawerStyles.drawerLabel
      }} 
    />
          
    <Drawer.Screen 
      name="+not-found" 
      options={{ 
        title: 'Not Found', 
        headerShown: false, 
        drawerItemStyle: { display: 'none' },
        swipeEdgeWidth: 0
      }} 
      />
    </Drawer>
  );
};

const drawerStyles = StyleSheet.create({
  drawerItem: {
    //height: 50,
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  drawerLabel: {
    fontSize: 22,
    fontWeight: 'bold',
  },
});

export default function RootLayout() {
  try {
    return (
      <OrientationProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SettingsProvider>
            <AppContent />
        </SettingsProvider>
      </GestureHandlerRootView>
      </OrientationProvider>
    );
  } catch (error) {
    return (
      <View style={errorStyles.errorContainer}>
        <Text style={errorStyles.errorText}>An error occurred while rendering the app.</Text>
      </View>
    );
  }
}

const errorStyles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8d7da',
  },
  errorText: {
    fontSize: 18,
    color: '#721c24',
  },
});
