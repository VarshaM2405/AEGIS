import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Dimensions, Platform, Alert, Linking, PanResponder, Animated, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Search, MapPin, Navigation, Clock, Shield, AlertTriangle, ChevronRight, Activity } from 'lucide-react-native';
import { GlobalContext } from '../contexts/GlobalContext';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const API_HOST = '192.168.0.104';

export default function RoutePlanningScreen() {
  const navigation = useNavigation();
  const { location } = useContext(GlobalContext);
  const [loading, setLoading] = useState(false);
  const [destination, setDestination] = useState({ name: '', coords: null });
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const mapRef = useRef(null);

  const startNavigation = () => {
    if (!destination.coords) return;
    setIsNavigating(true);
    if (mapRef.current) {
      mapRef.current.animateCamera({
        center: location.coords,
        pitch: 60,
        zoom: 18,
        heading: location?.coords?.heading || 0
      }, { duration: 1000 });
    }
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    if (mapRef.current) {
      mapRef.current.animateCamera({
        pitch: 0,
        heading: 0,
        zoom: 14
      }, { duration: 1000 });
    }
  };

  useEffect(() => {
    if (isNavigating && location?.coords && mapRef.current) {
      mapRef.current.animateCamera({
        center: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        },
        pitch: 60,
        zoom: 18,
        heading: location.coords.heading || 0
      }, { duration: 1000 });
    }
  }, [location.coords.latitude, location.coords.longitude, location.coords.heading, isNavigating]);

  // Fit to route when routes are loaded
  useEffect(() => {
    if (routes.length > 0 && !isNavigating && mapRef.current) {
      const allCoords = routes[selectedRouteIndex].geometry.coordinates.map(c => ({
        latitude: c[1],
        longitude: c[0]
      }));
      if (location?.coords) {
        allCoords.push({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      }
      mapRef.current.fitToCoordinates(allCoords, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [routes, selectedRouteIndex, isNavigating]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 3) {
        searchLocation(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchRoutes = async (destCoords) => {
    if (!location || !destCoords) return;
    setLoading(true);
    try {
      const { latitude, longitude } = location.coords;
      const url = `http://${API_HOST}:8000/api/routes?start_lat=${latitude}&start_lon=${longitude}&end_lat=${destCoords.latitude}&end_lon=${destCoords.longitude}`;
      const response = await fetch(url);
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data.routes && data.routes.length > 0) {
          setRoutes(data.routes);
          setSelectedRouteIndex(0);
        } else {
          alert("No safe routes found for this destination.");
        }
      } catch (e) {
        alert("AEGIS Server Error: The server returned an invalid response.");
      }
    } catch (err) {
      alert("Network Error: Could not reach the AEGIS Safety Server.");
    } finally {
      setLoading(false);
    }
  };

  const searchLocation = async (query) => {
    try {
      const coordMatch = query.match(/^([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[2]);
        setSearchResults([{
          main_name: "Navigate to Coordinates",
          display_name: `${lat}, ${lon}`,
          lat: lat,
          lon: lon,
          isCoordinate: true
        }]);
        return;
      }

      const lat = location?.coords?.latitude || 12.9716;
      const lon = location?.coords?.longitude || 77.5946;
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${lat}&lon=${lon}&limit=10`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.features) {
        const mappedResults = data.features.map(f => ({
          display_name: `${f.properties.name || ''} ${f.properties.street || ''} ${f.properties.city || ''}`.trim() || 'Unnamed Place',
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          main_name: f.properties.name || f.properties.street || 'Place'
        }));
        setSearchResults(mappedResults);
      }
    } catch (err) {
      console.error("Search fetch failed:", err);
    }
  };

  const selectDestination = (item) => {
    const coords = { latitude: item.lat, longitude: item.lon };
    setDestination({ name: item.main_name, coords });
    setIsSearching(false);
    fetchRoutes(coords);
  };

  const getSafetyScore = (dangerScore) => Math.max(0, Math.min(100, Math.round(100 - (dangerScore * 10))));
  const getPolylineCoords = (geometry) => geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));

  const currentRoute = routes[selectedRouteIndex];
  const safetyPercent = currentRoute ? getSafetyScore(currentRoute.danger_score) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#FDF8F9' }}>
      {/* Top Navigation Bar */}
      {!isNavigating ? (
        <SafeAreaView style={{ backgroundColor: '#FDF8F9', borderBottomWidth: 1, borderBottomColor: '#E5B2B950', zIndex: 50 }}>
          <View style={{ height: 45, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <ArrowLeft size={20} color="#4A2E35" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginHorizontal: 8, backgroundColor: '#FDF8F9', height: 42, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5B2B950' }}>
              <Search size={16} color="#9CA3AF" />
              <TextInput
                placeholder="Search Destination"
                style={{ flex: 1, marginLeft: 8, color: '#4A2E35', fontWeight: '500', fontSize: 16, paddingVertical: 8 }}
                value={searchQuery}
                onChangeText={(t) => { setSearchQuery(t); if (t.length > 0) setIsSearching(true); }}
              />
            </View>
          </View>
        </SafeAreaView>
      ) : (
        <SafeAreaView style={{ backgroundColor: '#D81B60', zIndex: 30 }}>
          <View style={{ paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12, marginRight: 16 }}>
              <Navigation size={24} color="white" />
            </View>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase' }}>Next Turn</Text>
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '900' }}>Continue on {destination.name}</Text>
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* Search Results */}
      {isSearching && (
        <View style={{ position: 'absolute', top: 115, left: 0, right: 0, bottom: 0, backgroundColor: '#FDF8F9', zIndex: 100, paddingHorizontal: 24, paddingTop: 8 }}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {searchResults.map((item, i) => (
              <TouchableOpacity key={i} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5B2B930', flexDirection: 'row', alignItems: 'center' }} onPress={() => selectDestination(item)}>
                {item.isCoordinate ? (
                  <Navigation size={20} color="#D81B60" style={{ marginRight: 12 }} />
                ) : (
                  <MapPin size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
                )}
                <View>
                  <Text style={{ color: '#4A2E35', fontWeight: 'bold' }}>{item.main_name}</Text>
                  <Text style={{ color: '#9E7A80', fontSize: 12 }} numberOfLines={1}>{item.display_name}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <View style={{ height: 200 }} />
          </ScrollView>
        </View>
      )}

      {/* Map Content (45% Height) */}
      <View style={{ height: '45%' }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: location?.coords?.latitude || 12.9716,
            longitude: location?.coords?.longitude || 77.5946,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {location && <Marker coordinate={location.coords} title="Origin" pinColor="blue" />}
          {destination.coords && <Marker coordinate={destination.coords} title="Destination" pinColor="red" />}
          {routes.map((r, i) => {
            if (selectedRouteIndex !== i) return null;
            return (
              <Polyline
                key={`route-${i}-${isNavigating}`}
                coordinates={getPolylineCoords(r.geometry)}
                strokeWidth={6}
                strokeColor={getSafetyScore(r.danger_score) > 70 ? '#34C759' : '#D81B60'}
                zIndex={2}
              />
            );
          })}
        </MapView>
      </View>

      {/* Details Slide (55% Height) */}
      {!isNavigating && currentRoute && (
        <View style={{ height: '55%', backgroundColor: '#FDF8F9', borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingHorizontal: 24, paddingTop: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 30, borderTopWidth: 1, borderColor: '#E5B2B950' }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {/* Route Summary */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#4A2E35' }}>{destination.name || 'Your Destination'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Clock size={16} color="#9CA3AF" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#9CA3AF', fontWeight: '600' }}>{(currentRoute.duration / 60).toFixed(0)} min • {(currentRoute.distance / 1000).toFixed(1)} km</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: safetyPercent > 70 ? '#34C759' : '#D81B60' }}>{safetyPercent}%</Text>
                <View style={{ backgroundColor: safetyPercent > 70 ? 'rgba(52, 199, 89, 0.15)' : 'rgba(216, 27, 96, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: safetyPercent > 70 ? '#34C759' : '#D81B60' }}>
                    {safetyPercent > 70 ? 'Safe' : 'Risky'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Segment Breakdown */}
            <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(229, 178, 185, 0.3)' }}>
              {[
                { name: 'Koramangala Main St', score: '95%', trend: 'up' },
                { name: 'Inner Ring Road', score: '78%', trend: 'up' },
                { name: 'Intermediate Junction', score: '92%', trend: 'up' }
              ].map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i === 2 ? 0 : 1, borderBottomColor: 'rgba(229, 178, 185, 0.2)' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#D81B60', marginRight: 12 }} />
                    <Text style={{ color: '#4A2E35', fontWeight: 'bold' }}>{s.name}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#4A2E35', fontWeight: 'bold', marginRight: 4 }}>{s.score}</Text>
                    <Activity size={14} color="#D81B60" style={{ transform: [{ rotate: '-45deg' }] }} />
                  </View>
                </View>
              ))}
            </View>

            {/* Warning Box */}
            <View style={{ backgroundColor: '#FDF8F9', padding: 20, borderRadius: 24, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#E5B2B9', marginBottom: 24 }}>
              <AlertTriangle size={24} color="#D81B60" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#D81B60', fontWeight: 'bold', fontSize: 18, marginBottom: 4 }}>Caution Ahead</Text>
                <Text style={{ color: '#9E7A80', fontSize: 14, lineHeight: 20 }}>Medium crime density detected 0.8 km ahead. Route optimized for safety.</Text>
              </View>
            </View>

            {/* Alternative Routes */}
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#4A2E35', marginBottom: 12, paddingHorizontal: 4 }}>Alternative Routes</Text>
            {routes.map((r, i) => {
                let label = 'Alternative Route';
                if (r.type === 'FASTEST / SAFEST') label = 'Fastest & Safest Route';
                else if (r.type === 'SAFEST') label = 'Safest Route';
                else if (r.type === 'FASTEST') label = 'Fastest Route';
                else if (r.type === 'BALANCED') label = 'Balanced Route';

                const rSafety = getSafetyScore(r.danger_score);
                const isSelected = selectedRouteIndex === i;
                return (
                <TouchableOpacity 
                  key={i} 
                  onPress={() => setSelectedRouteIndex(i)}
                  style={{ backgroundColor: isSelected ? '#FDF8F9' : 'white', borderWidth: 1, borderColor: isSelected ? '#D81B60' : 'rgba(229, 178, 185, 0.3)', borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <View>
                    <Text style={{ color: '#4A2E35', fontWeight: 'bold', fontSize: 16 }}>{label}</Text>
                    <Text style={{ color: '#9E7A80', fontSize: 12, marginTop: 4 }}>{(r.duration/60).toFixed(0)} min • {(r.distance/1000).toFixed(1)} km</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontWeight: 'bold', marginRight: 8, color: rSafety > 70 ? '#34C759' : '#D81B60', fontSize: 16 }}>{rSafety}%</Text>
                    <Shield size={20} color={rSafety > 70 ? '#34C759' : '#D1D5DB'} />
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Final CTA */}
            <TouchableOpacity
              onPress={startNavigation}
              style={{ marginBottom: 40, borderRadius: 32, overflow: 'hidden', height: 64, elevation: 8 }}
            >
              <LinearGradient
                colors={['#E5B2B9', '#D81B60']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
              >
                <Navigation size={24} color="white" style={{ marginRight: 12 }} />
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Start Navigation</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Navigation HUDs */}
      {isNavigating && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '25%', backgroundColor: 'white', borderTopLeftRadius: 40, borderTopRightRadius: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 30, padding: 32, zIndex: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <View>
              <Text style={{ color: '#4A2E35', fontWeight: '900', fontSize: 28 }}>{(currentRoute?.duration / 60).toFixed(0)} min</Text>
              <Text style={{ color: '#9E7A80', fontWeight: 'bold' }}>{(currentRoute?.distance / 1000).toFixed(1)} km remaining</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 28, fontWeight: '900', color: safetyPercent > 70 ? '#34C759' : '#D81B60' }}>{safetyPercent}%</Text>
              <Text style={{ color: '#9E7A80', fontWeight: 'bold' }}>Safety Level</Text>
            </View>
          </View>
          <TouchableOpacity onPress={stopNavigation} style={{ backgroundColor: '#D81B60', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 8 }}>
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>END NAVIGATION</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Prompt */}
      {!currentRoute && !loading && !isSearching && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', backgroundColor: '#FDF8F9', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 40, borderTopWidth: 1, borderColor: '#E5B2B950' }}>
          <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <View style={{ backgroundColor: 'rgba(229, 178, 185, 0.2)', padding: 32, borderRadius: 64, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(229, 178, 185, 0.5)' }}>
              <MapPin size={48} color="#DDA7A5" />
            </View>
            <Text style={{ color: '#4A2E35', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Plan your journey</Text>
            <Text style={{ color: '#9E7A80', textAlign: 'center', paddingHorizontal: 40 }}>Search for a destination to see the safest routes and geographic risk profiles.</Text>
          </View>
        </View>
      )}
    </View>
  );
}
