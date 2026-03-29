import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';

export default function SOSScreen() {
  const [countdown, setCountdown] = useState(15);
  const [status, setStatus] = useState("Holding...");
  const navigation = useNavigation();
  const { toggleSOS } = useContext(GlobalContext);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else {
      setStatus("Alerting Police, Notifying Contacts & Broadcasting to Community!");
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleCancel = () => {
    toggleSOS(); // reset global state
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>EMERGENCY SOS</Text>

      <View style={styles.pulseContainer}>
        <Text style={styles.timerText}>{countdown > 0 ? countdown : '!'}</Text>
      </View>

      <Text style={styles.statusText}>{status}</Text>
      
      {countdown > 0 && (
        <Text style={styles.subText}>Activating automatically in {countdown}s</Text>
      )}

      <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
        <Text style={styles.cancelText}>CANCEL & I'M SAFE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 40,
  },
  pulseContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 5,
    borderColor: '#fff',
  },
  timerText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  subText: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 10,
    marginBottom: 50,
  },
  cancelBtn: {
    backgroundColor: '#000',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 30,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  cancelText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
