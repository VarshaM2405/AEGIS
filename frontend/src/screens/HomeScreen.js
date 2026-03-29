import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useRef } from 'react';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { GlobalContext } from '../contexts/GlobalContext';

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
  { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];

export default function HomeScreen() {
  const { location, errorMsg } = useContext(GlobalContext);
  const navigation = useNavigation();
  const route = useRoute();
  const mapRef = useRef(null);
  const [heatmapActive, setHeatmapActive] = useState(false);
  const [heatmapPoints, setHeatmapPoints] = useState([{ latitude: 12.9716, longitude: 77.5946, weight: 10 }]);
  const [fetchStatus, setFetchStatus] = useState('Fetching...');
  const [activeRoute, setActiveRoute] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const fetchHeatmapData = async () => {
      try {
        const HOST = '192.168.0.101'; 
        const response = await fetch(`http://${HOST}:8000/api/crimes/heatmap`);
        const data = await response.json();
        if (Array.isArray(data)) {
          // Retain exact severity for precise geospatial plotting
          setHeatmapPoints(data);
          setFetchStatus(`Loaded ${data.length}`);
        } else {
          setFetchStatus(`Failed: Format error`);
        }
      } catch (err) {
        setFetchStatus('Network Error');
        console.error('Failed to fetch heatmap data:', err);
      }
    };
    fetchHeatmapData();
  }, []);

  // Handle incoming route from Planning Screen
  useEffect(() => {
    if (route.params?.selectedRoute) {
      setActiveRoute(route.params.selectedRoute);
      setIsNavigating(true);
      
      // Auto-focus on the route
      if (mapRef.current && route.params.selectedRoute.geometry.coordinates.length > 0) {
        const coords = route.params.selectedRoute.geometry.coordinates.map(c => ({
          latitude: c[1],
          longitude: c[0]
        }));
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }
    }
  }, [route.params?.selectedRoute]);

  // Handle Camera Tracking during Navigation
  useEffect(() => {
    if (isNavigating && location && mapRef.current) {
      mapRef.current.animateCamera({
        center: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        },
        pitch: 45,
        heading: location.coords.heading || 0,
        altitude: 1000,
        zoom: 17
      }, { duration: 1000 });
    }
  }, [location, isNavigating]);

  const initialRegion = {
    latitude: 12.9716, // Bangalore default
    longitude: 77.5946,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  const userCoords = location ? {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  } : null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={userCoords ? { ...userCoords, latitudeDelta: 0.05, longitudeDelta: 0.05 } : initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false} 
        customMapStyle={darkMapStyle}
      >
         {userCoords && <Marker coordinate={userCoords} pinColor="blue" title="You" />}
         {heatmapActive && heatmapPoints.slice(0, 3000).map((point, index) => {
            const severity = point.weight;
            let color = 'rgba(0, 0, 255, 0.4)'; // Blue (Cold)
            if (severity >= 8) color = 'rgba(255, 0, 0, 0.5)'; // Hot Red
            else if (severity >= 5) color = 'rgba(255, 165, 0, 0.5)'; // Orange
            else if (severity >= 3) color = 'rgba(255, 255, 0, 0.4)'; // Yellow

            return (
              <Circle
                key={`crime-${index}`}
                center={{ latitude: point.latitude, longitude: point.longitude }}
                radius={severity * 150 || 500} // Radius in precise geographic meters (Increased 10x!)
                fillColor={color}
                strokeWidth={1}
                strokeColor={color.replace('0.5', '0.8')} 
              />
            );
         })}

         {activeRoute && (
           <Polyline
             coordinates={activeRoute.geometry.coordinates.map(c => ({
               latitude: c[1],
               longitude: c[0]
             }))}
             strokeWidth={6}
             strokeColor={activeRoute.type.includes('SAFEST') ? '#34C759' : '#0A7AFF'}
           />
         )}
      </MapView>

      {isNavigating && (
        <View style={styles.navBar}>
          <View style={styles.navInfo}>
            <Text style={styles.navType}>{activeRoute?.type}</Text>
            <Text style={styles.navDest}>Heading to Destination</Text>
          </View>
          <TouchableOpacity 
            style={styles.exitNavBtn} 
            onPress={() => { setIsNavigating(false); setActiveRoute(null); }}
          >
            <Text style={styles.exitText}>Exit</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.floatingBtn, heatmapActive ? styles.activeHeatmap : {}]} 
        onPress={() => setHeatmapActive(!heatmapActive)}
      >
        <Text style={styles.btnText}>{heatmapActive ? `🔥 Heatmap ON (${fetchStatus})` : `🗺️ Heatmap OFF (${fetchStatus})`}</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.floatingBtn, { top: 120, backgroundColor: '#007AFF' }]} 
        onPress={() => navigation.navigate('RoutePlanning')}
      >
        <Text style={styles.btnText}>📍 Plan Route</Text>
      </TouchableOpacity>

      {/* Simple Custom Bottom Sheet (No Reanimated Required) */}
      <View style={styles.simpleBottomSheet}>
        <View style={styles.contentContainer}>
          <Text style={styles.sheetTitle}>Where to?</Text>
          <View style={styles.searchBar}>
            <Text style={{color: '#999'}}>Search Destination...</Text>
          </View>

          <Text style={styles.sectionText}>Recent Routes</Text>
          <View style={styles.recentRoute}>
            <Text style={styles.routeText}>Koramangala 4th Block</Text>
          </View>
          <View style={styles.recentRoute}>
            <Text style={styles.routeText}>Indiranagar Metro</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  floatingBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  activeHeatmap: { backgroundColor: '#ffdede', borderWidth: 1, borderColor: 'red' },
  btnText: { fontWeight: 'bold' },
  simpleBottomSheet: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
    paddingBottom: 30, // Safe area padding
  },
  contentContainer: { padding: 20 },
  sheetTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15 },
  searchBar: { 
    height: 50, 
    backgroundColor: '#f0f0f0', 
    borderRadius: 10, 
    justifyContent: 'center', 
    paddingHorizontal: 15,
    marginBottom: 20
  },
  sectionText: { fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#444' },
  recentRoute: {
    padding: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  routeText: { fontSize: 16 },
  navBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    height: 80,
    backgroundColor: '#000',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10
  },
  navInfo: { flex: 1 },
  navType: { color: '#34C759', fontWeight: 'bold', fontSize: 12 },
  navDest: { color: '#fff', fontSize: 16, fontWeight: '600' },
  exitNavBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  exitText: { color: '#fff', fontWeight: 'bold' }
});
