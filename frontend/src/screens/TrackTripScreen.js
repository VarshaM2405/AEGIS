// TrackTripScreen — the recipient's view: type in the code texted by the trip owner
// (see StartTripScreen.js), then poll that trip every 3s (same polling convention as
// everywhere else in this app — GlobalContext's nearby-SOS/active-SOS polls, HomeScreen's
// report poll). No auth: GET /api/trips/by-code/{code} is a public lookup, consistent
// with the rest of this backend's trust model.
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Search } from 'lucide-react-native';
import { MapView, Marker, PROVIDER_GOOGLE } from '../components/MapViewWrapper';
import { API_BASE_URL } from '../config';

export default function TrackTripScreen() {
  const navigation = useNavigation();
  const [codeInput, setCodeInput] = useState('');
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const lookupTrip = async (code) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/trips/by-code/${code}`);
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.detail || 'Trip not found.');
        setTrip(null);
        return;
      }
      setTrip(data);
    } catch (err) {
      console.error('Trip lookup failed:', err);
      setError('Could not reach AEGIS servers.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length < 4) {
      Alert.alert('Enter a code', 'Please enter the trip code you were texted.');
      return;
    }
    lookupTrip(code);
  };

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!trip || trip.status !== 'active') return;
    intervalRef.current = setInterval(() => lookupTrip(trip.trip_code), 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.trip_code, trip?.status]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F9' }}>
      <View className="px-6 pt-4 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <ArrowLeft size={24} color="#4A2E35" />
        </TouchableOpacity>
        <View>
          <Text className="text-2xl font-black text-[#4A2E35]">Track a Shared Trip</Text>
          <Text className="text-[#9E7A80] font-medium text-sm">Enter the code you were texted</Text>
        </View>
      </View>

      <View className="px-6 mb-4 flex-row items-center">
        <TextInput
          className="flex-1 bg-white h-14 rounded-2xl px-5 border border-[#E5B2B9]/50 text-[#4A2E35] font-bold text-lg mr-3"
          style={{ letterSpacing: 2 }}
          value={codeInput}
          onChangeText={(v) => setCodeInput(v.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          placeholder="CODE"
          placeholderTextColor="#9E7A80"
        />
        <TouchableOpacity
          onPress={handleTrack}
          disabled={loading}
          className="bg-[#D81B60] w-14 h-14 rounded-2xl items-center justify-center"
        >
          {loading ? <ActivityIndicator color="white" /> : <Search size={22} color="white" />}
        </TouchableOpacity>
      </View>

      {error && (
        <View className="px-6 mb-4">
          <Text className="text-[#D81B60] text-sm">{error}</Text>
        </View>
      )}

      {trip && (
        <>
          {trip.status !== 'active' && (
            <View className="mx-6 mb-4 bg-[#FEF1F5] border border-[#F4C9D3] rounded-2xl p-4">
              <Text className="text-[#4A2E35] font-bold">This trip has ended.</Text>
              <Text className="text-[#9E7A80] text-xs mt-1">Last known location shown below.</Text>
            </View>
          )}
          <View className="flex-1 mx-6 rounded-[32px] overflow-hidden shadow-sm border border-[#E5B2B9]/50 mb-6">
            <MapView
              provider={PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: trip.latitude || 12.9716,
                longitude: trip.longitude || 77.5946,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
              }}
              region={
                trip.latitude != null && trip.longitude != null
                  ? { latitude: trip.latitude, longitude: trip.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }
                  : undefined
              }
            >
              {trip.latitude != null && trip.longitude != null && (
                <Marker coordinate={{ latitude: trip.latitude, longitude: trip.longitude }} pinColor="#D81B60" />
              )}
              {trip.destination_latitude != null && trip.destination_longitude != null && (
                <Marker
                  coordinate={{ latitude: trip.destination_latitude, longitude: trip.destination_longitude }}
                  pinColor="#4A2E35"
                />
              )}
            </MapView>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
