import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');

  const handleNext = () => {
    if (step === 1 && phone.length >= 10) setStep(2);
    else if (step === 2 && otp.length === 4) setStep(3);
    else if (step === 3 && name && area) {
      // Login Complete
      navigation.replace('Home');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {step === 1 ? 'Enter Phone Number' : step === 2 ? 'Verify OTP' : 'Complete Profile'}
        </Text>
        
        <Text style={styles.subtitle}>
          {step === 1 ? 'Your number acts as your emergency ID.' : step === 2 ? `Sent to ${phone}` : 'Help community members identify you.'}
        </Text>

        {step === 1 && (
          <TextInput 
            style={styles.input}
            placeholder="Mobile Number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={10}
            autoFocus
          />
        )}

        {step === 2 && (
          <TextInput 
            style={styles.input}
            placeholder="4 Digit OTP"
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
            maxLength={4}
            autoFocus
          />
        )}

        {step === 3 && (
          <>
            <TextInput 
              style={styles.input}
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
            />
            <TextInput 
              style={[styles.input, { marginTop: 15 }]}
              placeholder="Home Area (e.g. Indiranagar)"
              value={area}
              onChangeText={setArea}
            />
          </>
        )}

        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {step === 3 ? 'Start Shielding' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', padding: 30 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 40 },
  input: {
    borderBottomWidth: 2,
    borderColor: '#eee',
    fontSize: 24,
    paddingVertical: 10,
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#000',
    padding: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
