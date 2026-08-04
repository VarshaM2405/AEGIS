import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Phone, Lock, User, MapPin, ArrowRight, CheckCircle2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';

import { API_BASE_URL } from '../config';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { location, setUser, setIsLoggedIn, setUserProfile } = useContext(GlobalContext);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Direct registration flow (no OTP)

  const handleRegister = async () => {
    if (!name.trim()) return Alert.alert("Missing Name", "Please enter your full name.");
    if (!phone || phone.length < 10) return Alert.alert("Missing Phone", "Please enter a valid phone number.");
    if (!emergencyContactName.trim() || emergencyContactPhone.length < 10) return Alert.alert("Missing Emergency Contact", "Please provide an emergency contact name and phone.");
    setLoading(true);
    try {
      const lat = location?.coords?.latitude || 12.9716;
      const lon = location?.coords?.longitude || 77.5946;

      const payload = { phone, name, area: area || '', latitude: lat, longitude: lon };
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.status === 'success') {
        // Locally store emergency contact so SOS can use it without DB changes
        setUser({ name, area, phone });
        setIsLoggedIn(true);
        setUserProfile({ name, phone, area, emergencyContactName, emergencyContactPhone });
        navigation.replace('Main');
      } else {
        // If backend rejected because user not verified, create user locally by calling a simple create endpoint fallback
        // For now show error
        Alert.alert("Error", data.message || "Registration failed");
      }
    } catch (err) {
       Alert.alert("Connection Error", "Backend unreachable: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    return (
      <View className="w-full px-8">
        <View className="mb-10 items-center">
          <View className="bg-white p-6 rounded-full shadow-sm mb-6 border border-[#E5B2B9]/20">
            <Phone size={40} color="#D81B60" />
          </View>
          <Text className="text-3xl font-bold text-[#4A2E35] mb-2">Welcome</Text>
          <Text className="text-[#9E7A80] text-center font-medium">Enter your details to get started.</Text>
        </View>

        <View className="space-y-4">
          <View className="bg-white h-16 rounded-2xl flex-row items-center px-5 shadow-sm border border-[#E5B2B9]/50">
            <User size={20} color="#DDA7A5" />
            <TextInput
              placeholder="Your Name"
              className="flex-1 ml-4 text-lg font-semibold h-full"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <View className="bg-white h-16 rounded-2xl flex-row items-center px-5 shadow-sm border border-[#E5B2B9]/50">
            <Phone size={20} color="#DDA7A5" />
            <TextInput
              placeholder="Mobile Number"
              className="flex-1 ml-4 text-lg font-semibold h-full"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
            />
          </View>

          <Text className="text-[#9E7A80] font-bold uppercase text-xs mt-2">Emergency Contact</Text>
          <Text className="text-[#9E7A80] text-xs mb-3">We'll notify them during an SOS.</Text>

          <View className="bg-white h-16 rounded-2xl flex-row items-center px-5 shadow-sm border border-[#E5B2B9]/50">
            <User size={20} color="#DDA7A5" />
            <TextInput
              placeholder="Contact Name"
              className="flex-1 ml-4 text-lg font-medium h-full"
              value={emergencyContactName}
              onChangeText={setEmergencyContactName}
            />
          </View>

          <View className="bg-white h-16 rounded-2xl flex-row items-center px-5 shadow-sm border border-[#E5B2B9]/50">
            <Phone size={20} color="#DDA7A5" />
            <TextInput
              placeholder="Contact Phone Number"
              className="flex-1 ml-4 text-lg font-medium h-full"
              keyboardType="phone-pad"
              value={emergencyContactPhone}
              onChangeText={setEmergencyContactPhone}
              maxLength={10}
            />
          </View>
        </View>

        <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.8} className="mt-6">
           <LinearGradient colors={['#E5B2B9', '#D81B60']} start={{x:0, y:0}} end={{x:1, y:0}} className="h-16 rounded-2xl items-center justify-center shadow-lg">
              <Text className="text-white text-lg font-bold">{loading ? "Starting..." : "Start Shielding"}</Text>
           </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  const translateY = { transform: [{ translateY: 0 }] };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F9' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center items-center">
        {renderForm()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
