import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, Linking, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Phone, Share2, Shield, PhoneIncoming, MapPin, Navigation } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { EXPO_DEV_URL } from '../config';

const { width } = Dimensions.get('window');

export default function ZonesScreen() {
  const { location } = useContext(GlobalContext);
  const navigation = useNavigation();
  const [activeStatusMessage, setActiveStatusMessage] = useState('Emergency services ready');
  const [qrValue, setQrValue] = useState('');
  const soundRef = useRef(null);

  useEffect(() => {
    return () => {
      const soundToClean = soundRef.current;
      if (soundToClean) {
        soundToClean.stopAsync().catch(() => {});
        soundToClean.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const makeEmergencyCall = () => {
    Linking.openURL('tel:112'); // Emergency number
  };

  const shareLocation = async () => {
    if (!location) {
      Alert.alert('Location not available');
      return;
    }
    const { latitude, longitude } = location.coords;
    const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const expoGoUrl = `${EXPO_DEV_URL}?location=${encodeURIComponent(googleMapsUrl)}`;
    const shareText = `My current location: ${googleMapsUrl}`;
    setQrValue(expoGoUrl);
    try {
      await Share.share({
        message: shareText,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share location');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F9' }}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View className="px-6 pt-4 pb-4">
          <LinearGradient colors={['#FDF8F9', '#F7D7DE']} className="rounded-b-[32px] p-4 shadow-sm">
            <View className="flex-row items-center">
              <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                <ArrowLeft size={24} color="#4A2E35" />
              </TouchableOpacity>
              <View>
                <Text className="text-2xl font-black text-[#4A2E35]">Emergency Toolkit</Text>
                <Text className="text-[#9E7A80] font-medium text-sm">Quick emergency actions</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Toolkit Statistics */}
        <View className="px-6 py-4">
          <View className="flex-row justify-center mb-4">
            <LinearGradient colors={['#FDF8F9', '#F8D8E0']} className="p-4 rounded-2xl shadow-sm border border-[#E5B2B950] items-center">
              <Phone size={24} color="#4A2E35" />
              <Text className="text-2xl font-bold text-[#4A2E35] mt-2">112</Text>
              <Text className="text-[#4A2E35] font-medium text-xs">Emergency</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Toolkit Controls */}
        <View className="px-6 mb-4">
          <LinearGradient colors={['#FDF8F9', '#F7D0DA']} className="rounded-[24px] shadow-lg border border-[#E5B2B950] p-6">
            <Text className="text-[#4A2E35] font-bold text-lg mb-4 text-center">Quick Actions</Text>
            
            <View className="space-y-4">
              <TouchableOpacity
                onPress={makeEmergencyCall}
                className="overflow-hidden rounded-3xl"
              >
                <LinearGradient
                  colors={['#D81B60', '#C71585']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="p-4 items-center"
                >
                  <Text className="text-white font-bold text-lg">CALL EMERGENCY SERVICES</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={shareLocation}
                className="overflow-hidden rounded-3xl"
              >
                <LinearGradient
                  colors={['#4A2E35', '#6B4A55']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="p-4 items-center"
                >
                  <Text className="text-white font-bold text-lg">SHARE CURRENT LOCATION</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('FakeCall')}
                className="overflow-hidden rounded-3xl"
              >
                <LinearGradient
                  colors={['#9E7A80', '#D81B60']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="p-4 items-center flex-row justify-center"
                >
                  <PhoneIncoming size={18} color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-lg">FAKE INCOMING CALL</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('StartTrip')}
                className="overflow-hidden rounded-3xl"
              >
                <LinearGradient
                  colors={['#D81B60', '#4A2E35']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="p-4 items-center flex-row justify-center"
                >
                  <Navigation size={18} color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-lg">SHARE MY TRIP</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('TrackTrip')}
                className="overflow-hidden rounded-3xl"
              >
                <LinearGradient
                  colors={['#4A2E35', '#D81B60']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="p-4 items-center flex-row justify-center"
                >
                  <MapPin size={18} color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-lg">TRACK A SHARED TRIP</Text>
                </LinearGradient>
              </TouchableOpacity>

              {qrValue ? (
                <View className="bg-white rounded-3xl p-4 border border-[#F5C6D1] items-center">
                  <Text className="text-[#4A2E35] font-bold text-sm mb-3">Expo Go QR</Text>
                  <QRCode value={qrValue} size={180} backgroundColor="white" color="#4A2E35" />
                  <Text className="text-[#6B4A55] text-xs font-mono mt-3 text-center">{qrValue}</Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </View>

        {/* Safety Status Card */}
        <View className="px-6 pb-6">
          <View className="bg-[#FDF2F7] p-4 rounded-3xl shadow-sm border border-[#F5C6D1]/50">
            <Text className="text-[#4A2E35] font-bold text-lg mb-3">Safety Status</Text>
            <View className="bg-white rounded-3xl p-4 border border-[#F5C6D1]">
              <Text className="text-[#4A2E35] text-sm">{activeStatusMessage}</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}