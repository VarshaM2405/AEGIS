import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Send, Shield, MapPin, AlertTriangle, ChevronRight, Bell, Layers } from 'lucide-react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const { width } = Dimensions.get('window');
const API_HOST = '192.168.0.104';

export default function HomeScreen() {
  const { location, user } = useContext(GlobalContext);
  const navigation = useNavigation();
  const [heatmapData, setHeatmapData] = useState([]);
  const [loadingMap, setLoadingMap] = useState(true);

  useEffect(() => {
    fetchHeatmap();
  }, []);

  const fetchHeatmap = async () => {
    try {
      const resp = await fetch(`http://${API_HOST}:8000/api/crimes/heatmap`);
      const data = await resp.json();
      // Map to correct format: { latitude, longitude, weight }
      setHeatmapData(data);
    } catch (err) {
      console.error("Heatmap fetch failed", err);
    } finally {
      setLoadingMap(false);
    }
  };



  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F9' }}>
      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-3xl font-black text-[#4A2E35]">Hello, <Text className="text-[#D81B60]">{user?.name?.split(' ')[0] || 'Explorer'}</Text></Text>
            <Text className="text-[#9E7A80] font-medium text-sm">Welcome to your safety dashboard</Text>
          </View>
          <TouchableOpacity onPress={() => Alert.alert('Notifications', 'No new alerts in your area.')} className="bg-white p-3 rounded-2xl shadow-sm border border-[#E5B2B9]50">
            <Bell size={24} color="#D81B60" />
          </TouchableOpacity>
        </View>

        {/* Live Safety Map Card */}
        <View className="bg-white rounded-[32px] shadow-lg border border-[#E5B2B9]50 mb-8 overflow-hidden h-64">
           {loadingMap ? (
             <View className="flex-1 items-center justify-center">
                <ActivityIndicator color="#D81B60" />
                <Text className="text-gray-400 mt-2 text-xs font-bold uppercase">Loading Heatmap...</Text>
             </View>
           ) : (
             <MapView
               provider={PROVIDER_GOOGLE}
               className="flex-1"
               initialRegion={{
                latitude: location?.coords?.latitude || 12.9716,
                longitude: location?.coords?.longitude || 77.5946,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
               }}
               customMapStyle={mapStyle}
             >
               {heatmapData.length > 0 && heatmapData.slice(0, 3000).map((point, index) => {
                 const severity = point.weight;
                 let color = 'rgba(0, 0, 255, 0.08)'; // Very subtle blue
                 if (severity >= 8) color = 'rgba(216, 27, 96, 0.15)'; // Subtle Magenta
                 else if (severity >= 5) color = 'rgba(255, 165, 0, 0.12)'; // Subtle Orange
                 else if (severity >= 3) color = 'rgba(255, 255, 0, 0.1)'; // Subtle Yellow

                 return (
                   <Circle
                     key={`crime-${index}`}
                     center={{ latitude: point.latitude, longitude: point.longitude }}
                     radius={severity * 80 || 300}
                     fillColor={color}
                     strokeWidth={0}
                     strokeColor="transparent"
                   />
                 );
               })}
               {location && <Marker coordinate={location.coords} pinColor="#D81B60" />}
             </MapView>
           )}
           <View className="absolute bottom-4 left-4 right-4 bg-white/90 p-3 rounded-2xl border border-white flex-row items-center shadow-sm">
              <Layers size={18} color="#D81B60" className="mr-2" />
              <Text className="text-[#4A2E35] font-bold text-xs uppercase tracking-tight">Active Crime Heatmap • Bangalore</Text>
           </View>
        </View>

        {/* Search Bar */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('RouteTab')}
          className="bg-white h-16 rounded-3xl flex-row items-center px-5 shadow-sm border border-[#E5B2B9]50 mb-8"
        >
          <Search size={22} color="#DDA7A5" />
          <Text className="flex-1 ml-4 text-[#9E7A80] font-medium">Where do you want to go?</Text>
          <LinearGradient colors={['#E5B2B9', '#D81B60']} className="p-3 rounded-2xl">
            <Send size={18} color="white" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick Features Grid */}
        <View className="flex-row justify-between mb-8">
          <TouchableOpacity className="bg-white flex-1 p-5 rounded-[24px] shadow-sm border border-[#E5B2B9]30 items-center mr-2">
            <View className="bg-[#D81B6015] p-4 rounded-full mb-3">
              <AlertTriangle size={24} color="#D81B60" />
            </View>
            <Text className="text-[#4A2E35] font-bold text-xs uppercase tracking-tight">Report</Text>
          </TouchableOpacity>
          
          <TouchableOpacity className="bg-white flex-1 p-5 rounded-[24px] shadow-sm border border-[#E5B2B9]30 items-center mx-2">
            <View className="bg-[#C7158515] p-4 rounded-full mb-3">
              <Shield size={24} color="#C71585" />
            </View>
            <Text className="text-[#4A2E35] font-bold text-xs uppercase tracking-tight">SOS</Text>
          </TouchableOpacity>
          
          <TouchableOpacity className="bg-white flex-1 p-5 rounded-[24px] shadow-sm border border-[#E5B2B9]30 items-center ml-2">
            <View className="bg-[#34C75915] p-4 rounded-full mb-3">
              <MapPin size={24} color="#34C759" />
            </View>
            <Text className="text-[#4A2E35] font-bold text-xs uppercase tracking-tight">Zones</Text>
          </TouchableOpacity>
        </View>

        {/* Global Security Platform Banner */}
        <LinearGradient 
          colors={['#D81B60', '#E5B2B9']} 
          start={{x: 0, y: 0}} end={{x: 1, y: 1}} 
          className="p-6 rounded-[32px] shadow-xl mb-10 flex-row items-center justify-between"
        >
          <View className="flex-1 pr-6">
            <Text className="text-white/80 font-bold text-xs uppercase tracking-widest mb-1">Network Status</Text>
            <Text className="text-white text-2xl font-black mb-2">AEGIS Active</Text>
            <Text className="text-white/90 text-xs font-medium leading-5">
              Live spatial routing and crime prediction active in your current location.
            </Text>
          </View>
          <View className="bg-white/20 p-4 rounded-full border border-white/30">
            <Shield size={40} color="white" />
          </View>
        </LinearGradient>

      </ScrollView>
    </SafeAreaView>
  );
}

const mapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#fdf8f9" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#9e7a80" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] }
];
