import { StyleSheet, View, TouchableOpacity, ScrollView, Switch, Text } from 'react-native';
import { DrawerContentScrollView, DrawerItem, DrawerItemList } from "@react-navigation/drawer";
import { Linking } from "react-native";
import { Ionicons, FontAwesome, FontAwesome5, Entypo } from '@expo/vector-icons';
import { useOrientation } from '../context/OrientationContext';
import { useAdvancedMode } from '../context/AdvancedModeContext';


const openLink = (url: string) => {
    Linking.openURL(url).catch((error) => {
        console.error('Error opening URL:', error);
    });
};

export default function CustomDrawerContent(props: any) {
    const { isAdvanced, setIsAdvanced } = useAdvancedMode();
    
    return (
        <ScrollView
            contentContainerStyle={styles.drawerContentContainer}
            showsVerticalScrollIndicator={false}
        >
            <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
                <View style={styles.drawerListContainer}>
                    <DrawerItemList {...props} />
                   
                </View>
            </DrawerContentScrollView>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    drawerItem: {
        justifyContent: 'center',
        //paddingHorizontal: 5,
    },
    drawerLabel: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    socialContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 20,
        paddingBottom: 80,
        borderTopWidth: 1,
        borderColor: '#ccc',
    },
    icon: {
        marginRight: 10,
    },
    drawerContentContainer: {
        flexGrow: 1,
    },
    drawerListContainer: {
        paddingTop: 10,
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        //justifyContent: 'space-between',
        paddingVertical: 15,
        paddingHorizontal: 15,
    },
    switchLabel: {
        fontSize: 22,
        fontWeight: '600',
        color: "#bbb",
        paddingHorizontal: 20,
    },
});
