import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Phone, Lock, User, MapPin, ArrowRight, CheckCircle2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';

const API_HOST = '192.168.0.104'; // Match current backend host 

export default function LoginScreen() {
  const navigation = useNavigation();
  const { location, setUser, setIsLoggedIn } = useContext(GlobalContext);
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (phone.length < 10) return Alert.alert("Invalid Phone", "Please enter a valid 10-digit number.");
    setLoading(true);
    try {
      const response = await fetch(`http://${API_HOST}:8000/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (data.status === 'sent') {
        setStep(2);
      } else {
        Alert.alert("Error", data.message || "Failed to send OTP");
      }
    } catch (err) {
      Alert.alert("Connection Error", "Check if backend is running at " + API_HOST);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 4) return;
    setLoading(true);
    try {
      const response = await fetch(`http://${API_HOST}:8000/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp_code: otp }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        if (data.user_exists) {
          setUser(data.user);
          setIsLoggedIn(true);
          navigation.replace('Main');
        } else {
          setStep(3);
        }
      } else {
        Alert.alert("Error", data.message || "Invalid OTP code");
      }
    } catch (err) {
      Alert.alert("Connection Error", "Verify backend is reachable.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name || !area) return Alert.alert("Missing Info", "Please fill all fields.");
    setLoading(true);
    try {
      const lat = location?.coords?.latitude || 12.9716;
      const lon = location?.coords?.longitude || 77.5946;
      
      const response = await fetch(`http://${API_HOST}:8000/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, area, latitude: lat, longitude: lon }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        setUser({ name, area });
        setIsLoggedIn(true);
        navigation.replace('Main');
      } else {
        Alert.alert("Error", data.message || "Registration failed");
      }
    } catch (err) {
       Alert.alert("Connection Error", "Backend unreachable.");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View className="w-full px-8">
            <View className="mb-10 items-center">
              <View className="bg-white p-6 rounded-full shadow-sm mb-6 border border-[#E5B2B9]20">
                <Phone size={40} color="#D81B60" />
              </View>
              <Text className="text-3xl font-bold text-[#4A2E35] mb-2">Welcome Back!</Text>
              <Text className="text-[#9E7A80] text-center font-medium">Verify your phone to start shielding your routes.</Text>
            </View>
            <View className="bg-white h-16 rounded-2xl flex-row items-center px-5 shadow-sm border border-[#E5B2B9]50 mb-8">
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
            <TouchableOpacity onPress={handleSendOTP} disabled={loading} activeOpacity={0.8}>
               <LinearGradient colors={['#E5B2B9', '#D81B60']} start={{x:0, y:0}} end={{x:1, y:0}} className="h-16 rounded-2xl items-center justify-center shadow-lg">
                  <Text className="text-white text-lg font-bold">{loading ? "Sending..." : "Send OTP code"}</Text>
               </LinearGradient>
            </TouchableOpacity>
          </View>
        );
      case 2:
        return (
          <View className="w-full px-8">
            <View className="mb-10 items-center">
               <View className="bg-white p-6 rounded-full shadow-sm mb-6 border border-[#E5B2B9]20">
                <Lock size={40} color="#D81B60" />
              </View>
              <Text className="text-3xl font-bold text-[#4A2E35] mb-2">Check Messages</Text>
              <Text className="text-[#9E7A80] text-center font-medium">We sent a verification code to {phone}. Check the backend terminal!</Text>
            </View>
            <View className="bg-white h-16 rounded-2xl flex-row items-center px-5 shadow-sm border border-[#E5B2B9]50 mb-8">
              <Lock size={20} color="#DDA7A5" />
              <TextInput
                placeholder="0000"
                className="flex-1 ml-4 text-2xl font-bold tracking-widest h-full"
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                maxLength={4}
                autoFocus
              />
            </View>
            <TouchableOpacity onPress={handleVerifyOTP} disabled={loading} activeOpacity={0.8}>
               <LinearGradient colors={['#D81B60', '#C71585']} start={{x:0, y:0}} end={{x:1, y:0}} className="h-16 rounded-2xl items-center justify-center shadow-lg">
                  <Text className="text-white text-lg font-bold">{loading ? "Verifying..." : "Verify OTP"}</Text>
               </LinearGradient>
            </TouchableOpacity>
             <TouchableOpacity className="mt-6 items-center" onPress={() => setStep(1)}>
               <Text className="text-[#D81B60] font-semibold">Change Phone Number</Text>
            </TouchableOpacity>
          </View>
        );
      case 3:
        return (
          <View className="w-full px-8">
            <View className="mb-8 items-center">
               <View className="bg-[#34C75920] p-6 rounded-full mb-6">
                <CheckCircle2 size={40} color="#34C759" />
              </View>
              <Text className="text-3xl font-bold text-[#4A2E35] mb-2">Set Up Profile</Text>
              <Text className="text-[#9E7A80] text-center font-medium">Final step! Help the community identify you.</Text>
            </View>
            <View className="space-y-4">
              <View className="bg-white h-16 rounded-2xl flex-row items-center px-5 shadow-sm border border-[#E5B2B9]50 mb-4">
                <User size={20} color="#DDA7A5" />
                <TextInput
                  placeholder="Full Name"
                  className="flex-1 ml-4 text-lg font-medium h-full"
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <View className="bg-white h-16 rounded-2xl flex-row items-center px-5 shadow-sm border border-[#E5B2B9]50 mb-8">
                <MapPin size={20} color="#DDA7A5" />
                <TextInput
                  placeholder="Home Area (e.g. Indiranagar)"
                  className="flex-1 ml-4 text-lg font-medium h-full"
                  value={area}
                  onChangeText={setArea}
                />
              </View>
            </View>
            <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
               <LinearGradient colors={['#E5B2B9', '#D81B60']} start={{x:0, y:0}} end={{x:1, y:0}} className="h-16 rounded-2xl items-center justify-center shadow-lg">
                  <Text className="text-white text-lg font-bold">{loading ? "Starting Shield..." : "Finish Registration"}</Text>
               </LinearGradient>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F9' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-center items-center">
        {renderStep()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
