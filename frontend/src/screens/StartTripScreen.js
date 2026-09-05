// StartTripScreen — "share my walk/ride" with a guardian, independent of SOS. Mirrors
// ReportScreen.js's tap-to-place map pattern for an optional destination, and SOSScreen.js's
// expo-sms flow for handing the recipient a way to track the trip (a 6-char code — this is
// in-app-only sharing, no deep-link infra configured, so the recipient must have AEGIS too).
import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Send, User } from 'lucide-react-native';
import * as SMS from 'expo-sms';
import { MapView, Marker, PROVIDER_GOOGLE } from '../components/MapViewWrapper';

const DURATION_PRESETS = [
  { label: 'No ETA', minutes: null },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
];

export default function StartTripScreen() {
  const navigation = useNavigation();
  const { location, startTrip } = useContext(GlobalContext);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [destinationLocation, setDestinationLocation] = useState(null);
  const [destinationLabel, setDestinationLabel] = useState('');
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [starting, setStarting] = useState(false);

  const sendTripSMS = async (trip) => {
    if (!trip.recipient_phone) return;
    const message = `I'm sharing my live trip with you on AEGIS. Open AEGIS -> "Track a Shared Trip" and enter code ${trip.trip_code} to follow along.`;
    try {
      const available = await SMS.isAvailableAsync();
      if (!available) {
        console.error('SMS composer is not available on this device.');
        return;
      }
      await SMS.sendSMSAsync([trip.recipient_phone], message);
    } catch (err) {
      console.error('Failed to open SMS composer:', err);
    }
  };

  const handleStart = async () => {
    if (recipientPhone.trim().length < 7) {
      Alert.alert('Missing Info', 'Please add a valid recipient phone number.');
      return;
    }
    setStarting(true);
    const result = await startTrip({
      recipientPhone: recipientPhone.trim(),
      destinationLabel: destinationLabel.trim() || null,
      destinationLatitude: destinationLocation?.latitude ?? null,
      destinationLongitude: destinationLocation?.longitude ?? null,
      etaMinutes,
    });
    setStarting(false);
    if (!result.success) {
      Alert.alert('Could not start trip', result.error);
      return;
    }
    await sendTripSMS(result.trip);
    navigation.replace('TripActive');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F9' }}>
      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <ArrowLeft size={24} color="#4A2E35" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-black text-[#4A2E35]">Share My Trip</Text>
            <Text className="text-[#9E7A80] font-medium text-sm">Let a trusted contact follow along live</Text>
          </View>
        </View>

        <View className="bg-white p-4 rounded-2xl shadow-sm border border-[#E5B2B9]/50 mb-6">
          <View className="flex-row items-center mb-3">
            <User size={18} color="#D81B60" />
            <Text className="text-[#4A2E35] font-bold text-sm ml-2">Recipient Phone</Text>
          </View>
          <TextInput
            className="bg-[#FAF5F5] p-3 rounded-2xl border border-[#E5B2B9]/50 text-[#4A2E35]"
            value={recipientPhone}
            onChangeText={setRecipientPhone}
            keyboardType="phone-pad"
            placeholder="Who should be able to track you?"
            placeholderTextColor="#9E7A80"
            maxLength={15}
          />
        </View>

        <View className="mb-6">
          <Text className="text-[#4A2E35] font-bold text-lg mb-3">How long?</Text>
          <View className="flex-row flex-wrap">
            {DURATION_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.label}
                onPress={() => setEtaMinutes(preset.minutes)}
                className={`mr-2 mb-2 px-4 py-2 rounded-full border ${
                  etaMinutes === preset.minutes ? 'bg-[#D81B60] border-[#D81B60]' : 'bg-white border-[#E5B2B9]/50'
                }`}
              >
                <Text className={`text-sm font-medium ${etaMinutes === preset.minutes ? 'text-white' : 'text-[#4A2E35]'}`}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="bg-white rounded-3xl overflow-hidden shadow-sm border border-[#E5B2B9]/50 mb-6">
          <View className="px-4 py-3 border-b border-[#E5B2B9]/50">
            <Text className="text-[#4A2E35] font-bold">Optional: tap to set a destination</Text>
            <Text className="text-[#9E7A80] text-xs mt-1">Helps your contact know where you're headed.</Text>
          </View>
          <View style={{ height: 220 }}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: (location && location.coords && location.coords.latitude) || 12.9716,
                longitude: (location && location.coords && location.coords.longitude) || 77.5946,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
              }}
              onPress={(event) => setDestinationLocation(event.nativeEvent.coordinate)}
            >
              {location && <Marker coordinate={location.coords} pinColor="#4A2E35" />}
              {destinationLocation && <Marker coordinate={destinationLocation} pinColor="#D81B60" />}
            </MapView>
          </View>
        </View>

        {destinationLocation && (
          <View className="mb-6">
            <TextInput
              className="bg-white p-4 rounded-2xl shadow-sm border border-[#E5B2B9]/50 text-[#4A2E35]"
              placeholder="Label this destination (e.g. Home)"
              placeholderTextColor="#9E7A80"
              value={destinationLabel}
              onChangeText={setDestinationLabel}
            />
          </View>
        )}

        <TouchableOpacity onPress={handleStart} disabled={starting} className="mb-10">
          <LinearGradient
            colors={starting ? ['#E5B2B9', '#D81B60'] : ['#D81B60', '#E5B2B9']}
            className="p-4 rounded-3xl shadow-lg items-center flex-row justify-center"
          >
            {starting ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Send size={20} color="white" />
                <Text className="text-white font-bold text-lg ml-2">Start Sharing</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
