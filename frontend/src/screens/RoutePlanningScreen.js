import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

// Dynamically use the same IP as HomeScreen for consistency
const HOST = Platform.OS === 'android' ? '192.168.0.101' : '192.168.0.101'; 

export default function RoutePlanningScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState({ name: 'Your Location', coords: null });
  const [destination, setDestination] = useState({ name: '', coords: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingFor, setSearchingFor] = useState(null); // 'origin' or 'destination'
  const [searchResults, setSearchResults] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [mapRegion, setMapRegion] = useState({
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        setOrigin({ name: 'Your Location', coords });
        setMapRegion(prev => ({ ...prev, ...coords }));
      }
    })();
  }, []);

  const searchLocation = async (query) => {
    if (query.length < 3) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&viewbox=77.3,13.2,77.8,12.7&bounded=1`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Geocoding failed", error);
    }
  };

  const selectLocation = (item) => {
    const coords = { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) };
    if (searchingFor === 'origin') {
      setOrigin({ name: item.display_name.split(',')[0], coords });
    } else {
      setDestination({ name: item.display_name.split(',')[0], coords });
    }
    setSearchingFor(null);
    setSearchResults([]);
    setMapRegion(prev => ({ ...prev, ...coords }));
  };

  const fetchRoutes = async () => {
    if (!origin.coords || !destination.coords) return;
    setLoading(true);
    try {
      const url = `http://${HOST}:8000/api/routes?start_lat=${origin.coords.latitude}&start_lon=${origin.coords.longitude}&end_lat=${destination.coords.latitude}&end_lon=${destination.coords.longitude}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes) {
        setRoutes(data.routes);
        setSelectedRouteIndex(0);
      }
    } catch (error) {
      console.error("Routing failed", error);
    } finally {
      setLoading(false);
    }
  };

  // Convert OSRM GeoJSON geometry to Google Maps Polyline coordinates
  const getPolylineCoords = (geometry) => {
    return geometry.coordinates.map(c => ({
      latitude: c[1],
      longitude: c[0]
    }));
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
  };

  const formatDistance = (meters) => {
    return (meters / 1000).toFixed(1) + ' km';
  };

  const getSafetyScore = (dangerScore) => {
    // Inverse danger score (max observed ~10) into a 0-100 score
    const score = Math.max(0, Math.min(100, Math.round(100 - (dangerScore * 10))));
    return score;
  };

  const getRouteColor = (type) => {
    if (type.includes('SAFEST')) return '#34C759'; // Green
    if (type.includes('FASTEST')) return '#0A7AFF'; // Blue
    return '#AF52DE'; // Purple for Balanced
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapWrapper}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={mapRegion}
        >
          {origin.coords && <Marker coordinate={origin.coords} title="Origin" pinColor="blue" />}
          {destination.coords && <Marker coordinate={destination.coords} title="Destination" pinColor="red" />}
          
          {routes.map((route, index) => {
            const isSelected = selectedRouteIndex === index;
            return (
              <Polyline
                key={index}
                coordinates={getPolylineCoords(route.geometry)}
                strokeWidth={isSelected ? 6 : 4}
                strokeColor={getRouteColor(route.type)}
                lineJoin="round"
                onPress={() => setSelectedRouteIndex(index)}
                tappable={true}
                zIndex={isSelected ? 2 : 1}
              />
            );
          })}
        </MapView>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
           <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.overlay}>
        <View style={styles.searchContainer}>
          <TouchableOpacity 
            style={styles.searchInput}
            onPress={() => { setSearchingFor('origin'); setSearchQuery(''); }}
          >
            <Text style={styles.searchText} numberOfLines={1}>{origin.name}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.searchInput, { marginTop: 10 }]}
            onPress={() => { setSearchingFor('destination'); setSearchQuery(''); }}
          >
            <Text style={styles.searchText} numberOfLines={1}>
              {destination.name || "Where are we going?"}
            </Text>
          </TouchableOpacity>

          {destination.coords && !routes.length && (
            <TouchableOpacity style={styles.fetchBtn} onPress={fetchRoutes}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.fetchBtnText}>Plan Routes</Text>}
            </TouchableOpacity>
          )}
        </View>

        {routes.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.routeSelector}>
            {routes.map((route, index) => {
              const score = getSafetyScore(route.danger_score);
              const isSelected = selectedRouteIndex === index;
              return (
                <TouchableOpacity 
                  key={index}
                  onPress={() => setSelectedRouteIndex(index)}
                  style={[styles.routeBadge, isSelected && { borderColor: getRouteColor(route.type), borderWidth: 2 }]}
                >
                  <Text style={[styles.routeBadgeType, { color: getRouteColor(route.type) }]}>{route.type}</Text>
                  <Text style={styles.routeBadgeTime}>{formatDuration(route.duration)} • {formatDistance(route.distance)}</Text>
                  <View style={[styles.safetyBadge, { backgroundColor: score > 70 ? '#34C759' : score > 40 ? '#FFCC00' : '#FF3B30' }]}>
                    <Text style={styles.safetyText}>{score}% SAFE</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {routes.length > 0 && (
           <TouchableOpacity 
              style={styles.navigateBtn}
              onPress={() => navigation.navigate('Home', { selectedRoute: routes[selectedRouteIndex] })}
           >
             <Text style={styles.navigateBtnText}>START NAVIGATION</Text>
           </TouchableOpacity>
        )}
      </View>

      {searchingFor && (
        <View style={styles.searchModal}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.searchHeader}>
              <TextInput
                autoFocus
                placeholder={`Search for ${searchingFor}...`}
                style={styles.modalInput}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchLocation(text);
                }}
              />
              <TouchableOpacity onPress={() => setSearchingFor(null)}>
                <Text style={styles.closeBtn}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }}>
              {searchResults.map((item, idx) => (
                <TouchableOpacity key={idx} style={styles.searchResultItem} onPress={() => selectLocation(item)}>
                  <Text style={styles.resultTitle}>{item.display_name.split(',')[0]}</Text>
                  <Text style={styles.resultSub}>{item.display_name.split(',').slice(1, 3).join(',')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mapWrapper: { flex: 0.6, width: '100%' },
  map: { width: '100%', height: '100%' },
  backButton: { position: 'absolute', top: 50, left: 20, backgroundColor: '#fff', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.2 },
  backButtonText: { fontSize: 24, fontWeight: 'bold' },
  overlay: { flex: 0.4, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 },
  searchContainer: { marginBottom: 15 },
  searchInput: { backgroundColor: '#F2F2F7', padding: 15, borderRadius: 12 },
  searchText: { fontSize: 16, color: '#000' },
  fetchBtn: { backgroundColor: '#000', padding: 15, borderRadius: 12, marginTop: 15, alignItems: 'center' },
  fetchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  routeSelector: { flexDirection: 'row', marginBottom: 20 },
  routeBadge: { backgroundColor: '#F2F2F7', padding: 15, borderRadius: 15, marginRight: 15, width: 160 },
  routeBadgeType: { fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  routeBadgeTime: { fontSize: 12, color: '#8E8E93', marginBottom: 10 },
  safetyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  safetyText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  navigateBtn: { backgroundColor: '#000', padding: 20, borderRadius: 35, alignItems: 'center' },
  navigateBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  searchModal: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', zIndex: 10 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  modalInput: { flex: 1, backgroundColor: '#F2F2F7', padding: 12, borderRadius: 10, marginRight: 15 },
  closeBtn: { color: '#007AFF', fontWeight: 'bold' },
  searchResultItem: { padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  resultTitle: { fontSize: 16, fontWeight: 'bold' },
  resultSub: { fontSize: 12, color: '#8E8E93' }
});
