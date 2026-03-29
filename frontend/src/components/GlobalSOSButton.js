import React, { useContext } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';

// Simple floating red button styling with NativeWind fallback
const GlobalSOSButton = () => {
  const { toggleSOS } = useContext(GlobalContext);
  const navigation = useNavigation();

  const handlePress = () => {
    toggleSOS();
    // Navigate to the SOS Modal overlay
    navigation.navigate('SOSModal');
  };

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
    padding: 24,
    zIndex: 9999, // ensures it sits above native views
    elevation: 10,
  },
  button: {
    backgroundColor: '#ff3b30',
    width: 65,
    height: 65,
    borderRadius: 35,
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
