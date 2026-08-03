import React, { useContext } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';

// Simple floating red button styling with NativeWind fallback
const GlobalSOSButton = () => {
  const { toggleSOS } = useContext(GlobalContext);
  const navigation = useNavigation();

  // GlobalSOSButton lives outside the Tab.Navigator (a sibling of it in
  // MainTabs), so its nearest navigation context is the outer Stack, not the
  // tabs. Drill into the "Main" route's nested tab state to find which tab
  // is actually focused, so we can hide the button while on the SOS tab.
  const focusedTabName = useNavigationState((state) => {
    const mainRoute = state?.routes.find((r) => r.name === 'Main');
    const tabState = mainRoute?.state;
    return tabState?.routes[tabState.index]?.name;
  });

  const handlePress = () => {
    toggleSOS();
    // Navigate to the SOS Modal overlay
    navigation.navigate('SOSModal');
  };

  if (focusedTabName === 'SOSTab') return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity 
        style={styles.button} 
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.text}>SOS</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 100, // hover just above the 90px tab bar
    paddingRight: 20,
    zIndex: 9999, // ensures it sits above native views
    elevation: 24, // must beat the tab bar's own elevation (20) on Android
  },
  button: {
    backgroundColor: '#ff3b30',
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 1,
  }
});

export default GlobalSOSButton;
