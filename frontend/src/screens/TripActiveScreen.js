// TripActiveScreen — the owner's live view of a trip already in progress. activeTrip
// itself and the periodic location-post both live in GlobalContext (not here), so the
// trip keeps updating even if the owner navigates away from this screen — same pattern
// as activeSOS outliving SOSScreen.
import React, { useContext, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';
import { CheckCircle } from 'lucide-react-native';
import * as SMS from 'expo-sms';
import { MapView, Marker, PROVIDER_GOOGLE } from '../components/MapViewWrapper';

export default function TripActiveScreen() {
  const navigation = useNavigation();
  const { location, activeTrip, endTrip } = useContext(GlobalContext);
  const [ending, setEnding] = useState(false);

  const resendTripSMS = async () => {
    if (!activeTrip?.recipient_phone) {
      Alert.alert('No recipient set', 'This trip has no recipient phone on file.');
      return;
    }
    const message = `I'm sharing my live trip with you on AEGIS. Open AEGIS -> "Track a Shared Trip" and enter code ${activeTrip.trip_code} to follow along.`;
    try {
      const available = await SMS.isAvailableAsync();
      if (!available) return;
      await SMS.sendSMSAsync([activeTrip.recipient_phone], message);
    } catch (err) {
      console.error('Resend trip SMS failed:', err);
    }
  };

  const handleEndTrip = async () => {
    setEnding(true);
    const result = await endTrip();
    setEnding(false);
    if (!result.success) {
      Alert.alert('Could not end trip', result.error);
      return;
    }
    navigation.goBack();
  };

  if (!activeTrip) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F9', alignItems: 'center', justifyContent: 'center' }}>
        <Text className="text-[#9E7A80]">No active trip.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-4">
          <Text className="text-[#D81B60] font-bold">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F9' }}>
      <View className="px-6 pt-4 pb-4">
        <Text className="text-2xl font-black text-[#4A2E35]">Trip in Progress</Text>
        <Text className="text-[#9E7A80] font-medium text-sm">Your live location is being shared.</Text>
      </View>

      <View className="flex-1 mx-6 rounded-[32px] overflow-hidden shadow-sm border border-[#E5B2B9]/50 mb-4">
        <MapView
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: (location && location.coords && location.coords.latitude) || activeTrip.latitude || 12.9716,
            longitude: (location && location.coords && location.coords.longitude) || activeTrip.longitude || 77.5946,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
        >
          {location && <Marker coordinate={location.coords} pinColor="#D81B60" />}
          {activeTrip.destination_latitude != null && activeTrip.destination_longitude != null && (
            <Marker
              coordinate={{ latitude: activeTrip.destination_latitude, longitude: activeTrip.destination_longitude }}
              pinColor="#4A2E35"
            />
          )}
        </MapView>
      </View>

      <View className="px-6 pb-8">
        <View className="bg-white rounded-3xl p-5 border border-[#E5B2B9]/50 shadow-sm mb-4 items-center">
          <Text className="text-[#9E7A80] text-xs font-bold uppercase mb-1">Trip Code</Text>
          <Text style={{ letterSpacing: 4 }} className="text-3xl font-black text-[#D81B60]">{activeTrip.trip_code}</Text>
          {activeTrip.recipient_phone && (
            <Text className="text-[#9E7A80] text-xs mt-2">Shared with {activeTrip.recipient_phone}</Text>
          )}
          <TouchableOpacity onPress={resendTripSMS} className="mt-3 bg-[#FDF8F9] border border-[#D81B6050] rounded-full px-4 py-2">
            <Text className="text-[#D81B60] font-bold text-xs">Re-send Code via SMS</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleEndTrip}
          disabled={ending}
          className="bg-[#1F7A4E] rounded-3xl py-4 items-center flex-row justify-center"
        >
          <CheckCircle size={20} color="white" style={{ marginRight: 8 }} />
          <Text className="text-white text-lg font-black">{ending ? 'Ending...' : "I've Arrived - End Trip"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
