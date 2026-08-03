import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Alert, Modal, Switch, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Send, Shield, MapPin, AlertTriangle, Bell, Layers } from 'lucide-react-native';
import { MapView, Circle, Marker, Polyline, PROVIDER_GOOGLE } from '../components/MapViewWrapper';

const { width } = Dimensions.get('window');
import { API_BASE_URL } from '../config';

function PulsingSOSMarker() {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }], backgroundColor: '#FF1744', padding: 8, borderRadius: 20, borderWidth: 3, borderColor: 'white' }}>
      <Text style={{ fontSize: 16 }}>🚨</Text>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { location, user, notifications, removeNotification, clearNotifications, nearbySOS, respondToSOS } = useContext(GlobalContext);
  const navigation = useNavigation();
  const [heatmapData, setHeatmapData] = useState([]);
  const [reportAlerts, setReportAlerts] = useState([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [responding, setResponding] = useState(false);
  const [selectedSOS, setSelectedSOS] = useState(null);
  const [respondingSOS, setRespondingSOS] = useState(false);
  const [activeStatusMessage, setActiveStatusMessage] = useState('No active alerts nearby');
  const [responderRoute, setResponderRoute] = useState(null);
  const mapRef = useRef(null);

  const [refreshInterval, setRefreshInterval] = useState(null);

  useEffect(() => {
    fetchHeatmap();
    fetchReports();

    const interval = setInterval(fetchReports, 3000);
    setRefreshInterval(interval);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchReports();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchHeatmap = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/crimes/heatmap`);
      const data = await resp.json();
      setHeatmapData(data);
    } catch (err) {
      console.error('Heatmap fetch failed', err);
    } finally {
      setLoadingMap(false);
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/reports`);
      const data = await resp.json();
      const reports = (data.reports || []).filter((report) => report.status !== 'resolved');
      console.log('Fetched reports - Total:', data.reports ? data.reports.length : 0, 'Non-resolved:', reports.length);
      setReportAlerts(reports);

      const activeResponderCount = reports.filter((report) => report.responder_id).length;
      setActiveStatusMessage(
        reports.length === 0
          ? 'No active alerts nearby'
          : activeResponderCount > 0
          ? `${activeResponderCount} active responder${activeResponderCount > 1 ? 's' : ''} nearby`
          : 'Emergency mode active'
      );

      setSelectedReport((prev) => {
        if (!prev) return prev;
        const updated = reports.find((report) => report.id === prev.id);
        return updated || null;
      });
    } catch (err) {
      console.error('Report fetch failed', err);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleRespond = async () => {
    if (!user?.phone || !selectedReport) return;
    setResponding(true);

    try {
      const resp = await fetch(`${API_BASE_URL}/api/reports/${selectedReport.id}/respond`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.phone, action: 'respond' }),
      });
      const data = await resp.json();

      if (data.status === 'success') {
        setSelectedReport(data.report);
        fetchReports();
      } else {
        Alert.alert('Unable to respond', data.message || 'Could not claim this alert.');
      }
    } catch (err) {
      console.error('Respond request failed', err);
      Alert.alert('Connection Error', 'Could not update alert status.');
    } finally {
      setResponding(false);
    }
  };

  const handleResolve = async () => {
    if (!user?.phone || !selectedReport) return;
    
    console.log('=== RESOLVING ALERT ===', selectedReport.id);
    
    // Pause auto-refresh to prevent alert from reappearing
    if (refreshInterval) {
      clearInterval(refreshInterval);
      console.log('Paused auto-refresh interval');
    }
    
    // Immediately remove from UI
    const reportId = selectedReport.id;
    setSelectedReport(null);
    setReportAlerts((prev) => {
      const updated = prev.filter((report) => report.id !== reportId);
      console.log('Removed from reportAlerts. Before:', prev.length, 'After:', updated.length);
      return updated;
    });
    if (removeNotification) {
      removeNotification(reportId);
      console.log('Removed from notifications');
    }
    setResponding(true);

    try {
      const resp = await fetch(`${API_BASE_URL}/api/reports/${reportId}/respond`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.phone, action: 'resolve' }),
      });
      const data = await resp.json();

      if (data.status === 'success') {
        console.log('Resolve API succeeded');
        Alert.alert('Resolved', 'This alert has been marked as resolved.');
        // Immediately fetch to sync with backend
        await fetchReports();
        // Restart refresh interval after successful resolution
        const newInterval = setInterval(fetchReports, 3000);
        setRefreshInterval(newInterval);
        console.log('Restarted auto-refresh interval');
      } else {
        // If API fails, refresh to revert
        await fetchReports();
        Alert.alert('Unable to resolve', data.message || 'Could not resolve this alert.');
        // Restart refresh interval
        const newInterval = setInterval(fetchReports, 3000);
        setRefreshInterval(newInterval);
      }
    } catch (err) {
      console.error('Resolve request failed', err);
      // If connection fails, refresh to revert
      await fetchReports();
      Alert.alert('Connection Error', 'Could not update alert status.');
      // Restart refresh interval
      const newInterval = setInterval(fetchReports, 3000);
      setRefreshInterval(newInterval);
    } finally {
      setResponding(false);
    }
  };

  const mergeAlerts = () => {
    const unique = {};
    [...notifications, ...reportAlerts].forEach((item) => {
      if (!item || !item.id) return;
      // Filter out resolved reports
      if (item.status === 'resolved') {
        console.log('Filtering out resolved alert:', item.id, item.status);
        return;
      }
      // Keep non-resolved items
      unique[item.id] = item;
    });
    const result = Object.values(unique);
    console.log('Merged alerts count:', result.length, 'Total notifications:', notifications.length, 'Total reportAlerts:', reportAlerts.length);
    return result;
  };

  const mergedAlerts = mergeAlerts();

  const formatDateTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const formatDistance = (km) => (km == null ? '—' : km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`);

  useEffect(() => {
    // Keep the open SOS modal in sync with live polling data from GlobalContext.
    // GET /api/sos/active only ever returns status in ("active", "responding"), so
    // an id disappearing from nearbySOS means it was resolved/cancelled (or moved
    // out of radius) — in that case close the modal rather than show a stale
    // snapshot with a "respond" button for an SOS that's no longer actionable.
    setSelectedSOS((prev) => {
      if (!prev) return prev;
      const updated = nearbySOS.find((sos) => sos.id === prev.id);
      return updated || null;
    });
  }, [nearbySOS]);

  const handleRespondToSOS = async () => {
    if (!selectedSOS) return;
    const sosIdAtRequestTime = selectedSOS.id;
    setRespondingSOS(true);
    const result = await respondToSOS(sosIdAtRequestTime);
    setRespondingSOS(false);
    if (result.success) {
      setSelectedSOS((current) =>
        current && current.id === sosIdAtRequestTime
          ? { ...result.sos, distance_km: current.distance_km }
          : current
      );
    } else {
      Alert.alert('Unable to respond', result.error);
    }
  };

  // The SOS (if any) that this device is the assigned responder for, derived
  // straight from the live-polled nearbySOS list so it always reflects the
  // current backend state (e.g. clears itself if the victim cancels).
  const myActiveResponse = nearbySOS.find((sos) => sos.responder_id === user?.phone) || null;

  useEffect(() => {
    if (!myActiveResponse || !location?.coords) {
      setResponderRoute(null);
      return;
    }
    let cancelled = false;
    const { latitude, longitude } = location.coords;
    const url = `${API_BASE_URL}/api/routes?start_lat=${latitude}&start_lon=${longitude}&end_lat=${myActiveResponse.latitude}&end_lon=${myActiveResponse.longitude}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const best = data.routes && data.routes[0];
        if (!best) return;
        const coords = best.geometry.coordinates.map((c) => ({ latitude: c[1], longitude: c[0] }));
        setResponderRoute(coords);
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
            animated: true,
          });
        }
      })
      .catch((err) => console.error('Responder route fetch failed:', err));
    return () => { cancelled = true; };
  }, [myActiveResponse?.id]);

  const renderSelectedReport = () => {
    if (!selectedReport) return null;

    const status = selectedReport.status || 'pending';
    const statusLabel = status.replace('_', ' ').toUpperCase();
    const isPoster = selectedReport.user_id === user?.phone;
    const alreadyResponding = selectedReport.responder_id === user?.phone;
    const canResolve = (isPoster || alreadyResponding) && status !== 'resolved';
    const canRespond = !isPoster && !selectedReport.responder_id && status === 'pending' && Boolean(user?.phone);
    const responder = selectedReport.responder || null;
    const statusMessage =
      status === 'resolved'
        ? 'This alert has been marked resolved and is no longer active.'
        : status === 'in_review'
          ? alreadyResponding
            ? 'You are responding to this alert. Stay safe and update status when resolved.'
            : 'A responder is on the way to help at the reported location.'
          : 'This alert is new and waiting for a nearby responder to claim it.';

    return (
      <View className="bg-white rounded-[32px] shadow-sm border border-[#E5B2B9]50 mb-6 p-5">
        <View className="flex-row justify-between items-start mb-4">
          <View className="flex-1 pr-3">
            <Text className="text-[#4A2E35] font-bold text-xl">Alert Details</Text>
            <Text className="text-[#9E7A80] text-sm mt-1">Tap another map pin to review other alerts.</Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedReport(null)} className="bg-[#F8E6EC] px-4 py-2 rounded-full self-start">
            <Text className="text-[#D81B60] font-bold">Close</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-[#FDF2F7] rounded-3xl p-4 mb-4 border border-[#F5C6D1]">
          <Text className="text-[#D81B60] font-black text-base uppercase tracking-widest mb-2">{selectedReport.type}</Text>
          <Text className="text-[#4A2E35] font-medium text-sm">{selectedReport.description}</Text>
        </View>

        <View className="bg-[#F8E6EC] rounded-3xl p-4 mb-4 border border-[#F5C6D1]">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-[#4A2E35] font-semibold">Current Status</Text>
            <View className={`rounded-full px-3 py-2 ${status === 'resolved' ? 'bg-[#D1F2E0]' : status === 'in_review' ? 'bg-[#FDF4E6]' : 'bg-[#F8E6EC]'}`}>
              <Text className={`text-xs font-bold ${status === 'resolved' ? 'text-[#1F7A4E]' : status === 'in_review' ? 'text-[#B86F00]' : 'text-[#D81B60]'}`}>{statusLabel}</Text>
            </View>
          </View>
          <Text className="text-[#4A2E35] text-sm leading-6">{statusMessage}</Text>
          {selectedReport.responder_id ? (
            <Text className="text-[#9E7A80] text-xs mt-3">Responder: {alreadyResponding ? 'You' : responder?.name || selectedReport.responder_id}</Text>
          ) : (
            <Text className="text-[#9E7A80] text-xs mt-3">No responder assigned yet.</Text>
          )}
        </View>

        {responder && (
          <View className="bg-[#EFF6FF] rounded-3xl p-4 mb-4 border border-[#D1E3FF]">
            <Text className="text-[#4A2E35] font-semibold mb-2">Responder Details</Text>
            <Text className="text-[#4A2E35] text-sm">Name: {responder.name || responder.phone}</Text>
            <Text className="text-[#4A2E35] text-sm mt-1">Contact: {responder.phone}</Text>
            {responder.area ? <Text className="text-[#4A2E35] text-sm mt-1">Area: {responder.area}</Text> : null}
          </View>
        )}

        {canResolve && (
          <TouchableOpacity
            onPress={handleResolve}
            disabled={responding}
            className="bg-[#1F7A4E] rounded-3xl px-4 py-3 mb-4 items-center"
          >
            {responding ? (
              <Text className="text-white font-bold">Resolving alert...</Text>
            ) : (
              <Text className="text-white font-bold">RESOLVED</Text>
            )}
          </TouchableOpacity>
        )}

        {canRespond && (
          <TouchableOpacity
            onPress={handleRespond}
            disabled={responding}
            className="bg-[#D81B60] rounded-3xl px-4 py-3 mb-4 items-center"
          >
            {responding ? (
              <Text className="text-white font-bold">Claiming alert...</Text>
            ) : (
              <Text className="text-white font-bold">I’m Responding</Text>
            )}
          </TouchableOpacity>
        )}

        <View className="space-y-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-[#4A2E35] font-semibold">Location</Text>
            <Text className="text-[#9E7A80] text-right text-sm">{(typeof selectedReport.latitude === 'number' ? selectedReport.latitude.toFixed(4) : selectedReport.latitude) ?? '-'}, {(typeof selectedReport.longitude === 'number' ? selectedReport.longitude.toFixed(4) : selectedReport.longitude) ?? '-'}</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-[#4A2E35] font-semibold">Reported</Text>
            <Text className="text-[#9E7A80] text-sm">{formatDateTime(selectedReport.timestamp || selectedReport.created_at)}</Text>
          </View>
        </View>
      </View>
    );
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
          <TouchableOpacity
            onPress={() => setNotificationModalVisible(true)}
            className="bg-white p-3 rounded-2xl shadow-sm border border-[#E5B2B9]50"
            style={{ position: 'relative' }}
          >
            <Bell size={24} color="#D81B60" />
            {mergedAlerts.length > 0 && (
              <View style={{ position: 'absolute', top: 2, right: 2, backgroundColor: '#D81B60', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{mergedAlerts.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Modal visible={notificationModalVisible} animationType="slide" transparent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 30, padding: 20, maxHeight: '85%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#4A2E35' }}>Alerts</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {notifications.length > 0 && (
                    <TouchableOpacity onPress={clearNotifications}>
                      <Text style={{ color: '#D81B60', fontWeight: '700' }}>Clear All</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setNotificationModalVisible(false)}>
                    <Text style={{ color: '#D81B60', fontWeight: '700' }}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {loadingReports ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <ActivityIndicator color="#D81B60" />
                </View>
              ) : mergedAlerts.length === 0 ? (
                <Text style={{ color: '#9E7A80', fontSize: 14 }}>No alerts available yet.</Text>
              ) : (
                <ScrollView>
                  {mergedAlerts.map((report) => (
                    <TouchableOpacity
                      key={report.id}
                      onPress={() => {
                        setSelectedReport(report);
                        setNotificationModalVisible(false);
                      }}
                      style={{ backgroundColor: '#FDF8F9', marginBottom: 12, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#E5B2B9' }}
                    >
                      <Text style={{ color: '#4A2E35', fontWeight: '800', marginBottom: 4 }}>{report.type}</Text>
                      <Text style={{ color: '#9E7A80', fontSize: 13, marginBottom: 6 }} numberOfLines={2}>{report.description}</Text>
                      <Text style={{ color: '#D81B60', fontSize: 11 }}>{formatDateTime(report.timestamp || report.created_at)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={!!selectedSOS} animationType="slide" transparent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 30, padding: 24, borderWidth: 2, borderColor: '#FF1744' }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#D81B60', marginBottom: 8 }}>🚨 Emergency SOS</Text>
              {selectedSOS && (
                <>
                  <Text style={{ color: '#4A2E35', fontSize: 15, marginBottom: 4 }}>User: {selectedSOS.user_name}</Text>
                  <Text style={{ color: '#4A2E35', fontSize: 15, marginBottom: 4 }}>Phone: {selectedSOS.user_phone}</Text>
                  <Text style={{ color: '#9E7A80', fontSize: 13, marginBottom: 16 }}>{formatDistance(selectedSOS.distance_km)} away</Text>

                  {selectedSOS.responder_id ? (
                    <Text style={{ color: '#1F7A4E', fontWeight: '700', marginBottom: 16 }}>
                      {selectedSOS.responder_id === user?.phone ? 'You are responding to this SOS.' : `${selectedSOS.responder_name} is already responding.`}
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={handleRespondToSOS}
                      disabled={respondingSOS}
                      style={{ backgroundColor: '#D81B60', borderRadius: 20, paddingVertical: 14, alignItems: 'center', marginBottom: 12 }}
                    >
                      <Text style={{ color: 'white', fontWeight: '900' }}>{respondingSOS ? 'Responding...' : 'I Can Help / Respond'}</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              <TouchableOpacity onPress={() => setSelectedSOS(null)}>
                <Text style={{ color: '#9E7A80', textAlign: 'center', fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {nearbySOS.length > 0 && (
          <TouchableOpacity
            onPress={() => setSelectedSOS(nearbySOS[0])}
            activeOpacity={0.85}
            style={{ backgroundColor: '#D81B60', borderRadius: 24, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#FF1744' }}
          >
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
              🚨 Community Emergency Alert
            </Text>
            <Text style={{ color: 'white', fontWeight: '700', marginTop: 4 }}>
              SOS {formatDistance(nearbySOS[0].distance_km)} away! User: {nearbySOS[0].user_name} (Phone: {nearbySOS[0].user_phone})
            </Text>
          </TouchableOpacity>
        )}

        {renderSelectedReport()}

        {/* Live Safety Map Card */}
        <View className="bg-white rounded-[32px] shadow-lg border border-[#E5B2B9]50 mb-8 overflow-hidden h-64">
           {loadingMap ? (
             <View className="flex-1 items-center justify-center">
                <ActivityIndicator color="#D81B60" />
                <Text className="text-gray-400 mt-2 text-xs font-bold uppercase">Loading Heatmap...</Text>
             </View>
           ) : (
             <MapView
               ref={mapRef}
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
                 let color = 'rgba(0, 0, 255, 0.08)';
                 if (severity >= 8) color = 'rgba(216, 27, 96, 0.15)';
                 else if (severity >= 5) color = 'rgba(255, 165, 0, 0.12)';
                 else if (severity >= 3) color = 'rgba(255, 255, 0, 0.1)';

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

               {mergedAlerts.map((report) => (
                 <Marker
                   key={`alert-${report.id}`}
                   coordinate={{ latitude: report.latitude, longitude: report.longitude }}
                   pinColor="#D81B60"
                   onPress={() => setSelectedReport(report)}
                 />
               ))}

               {nearbySOS.map((sos) => (
                 <Marker
                   key={`sos-${sos.id}`}
                   coordinate={{ latitude: sos.latitude, longitude: sos.longitude }}
                   onPress={() => setSelectedSOS(sos)}
                   tracksViewChanges={true}
                 >
                   <PulsingSOSMarker />
                 </Marker>
               ))}

               {responderRoute && (
                 <Polyline
                   coordinates={responderRoute}
                   strokeWidth={5}
                   strokeColor="#2979FF"
                   zIndex={3}
                 />
               )}

               {location && <Marker coordinate={location.coords} pinColor="#000000" />}
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
          <TouchableOpacity 
            onPress={() => navigation.navigate('Report')}
            className="bg-white flex-1 p-5 rounded-[24px] shadow-sm border border-[#E5B2B9]30 items-center mr-2"
          >
            <View className="bg-[#D81B6015] p-4 rounded-full mb-3">
              <AlertTriangle size={24} color="#D81B60" />
            </View>
            <Text className="text-[#4A2E35] font-bold text-xs uppercase tracking-tight">Report</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => navigation.navigate('SOSModal')}
            className="bg-white flex-1 p-5 rounded-[24px] shadow-sm border border-[#E5B2B9]30 items-center mx-2"
          >
            <View className="bg-[#C7158515] p-4 rounded-full mb-3">
              <Shield size={24} color="#C71585" />
            </View>
            <Text className="text-[#4A2E35] font-bold text-xs uppercase tracking-tight">SOS</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => navigation.navigate('Zones')}
            className="bg-white flex-1 p-5 rounded-[24px] shadow-sm border border-[#E5B2B9]30 items-center ml-2"
          >
            <View className="bg-[#34C75915] p-4 rounded-full mb-3">
              <Shield size={24} color="#34C759" />
            </View>
            <Text className="text-[#4A2E35] font-bold text-xs uppercase tracking-tight">Toolkit</Text>
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
