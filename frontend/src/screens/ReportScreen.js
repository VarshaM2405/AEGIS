import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Send, MapPin, AlertTriangle, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { MapView, Marker, PROVIDER_GOOGLE } from '../components/MapViewWrapper';
import { API_BASE_URL } from '../config';

const incidentTypes = [
  'Theft/Robbery',
  'Harassment',
  'Assault',
  'Suspicious Activity',
  'Traffic Incident',
  'Medical Emergency',
  'Fire',
  'Other'
];

export default function ReportScreen() {
  const { location, user, addNotification } = useContext(GlobalContext);
  const navigation = useNavigation();
  const [selectedType, setSelectedType] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    if (location && useCurrentLocation) {
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      setLatitude(String(lat));
      setLongitude(String(lon));
      setSelectedLocation({ latitude: lat, longitude: lon });
    }
  }, [location, useCurrentLocation]);

  useEffect(() => {
    if (!useCurrentLocation && selectedLocation) {
      setLatitude(String(selectedLocation.latitude));
      setLongitude(String(selectedLocation.longitude));
    }
  }, [selectedLocation, useCurrentLocation]);

  const requestPermissions = async (camera = false) => {
    if (camera) {
      const res = await ImagePicker.requestCameraPermissionsAsync();
      const cameraStatus = res?.status ?? res?.granted ?? null;
      if (cameraStatus !== 'granted' && cameraStatus !== true) {
        Alert.alert('Permission required', 'Camera access is needed to take photos.');
        return false;
      }
    }

    const libRes = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const libraryStatus = libRes?.status ?? libRes?.granted ?? null;
    if (libraryStatus !== 'granted' && libraryStatus !== true) {
      Alert.alert('Permission required', 'Photo library access is needed to choose images.');
      return false;
    }

    return true;
  };

  const pickPhoto = async () => {
    const granted = await requestPermissions(false);
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setPhotos((prev) => [...prev, uri]);
    }
  };

  const takePhoto = async () => {
    const granted = await requestPermissions(true);
    if (!granted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setPhotos((prev) => [...prev, uri]);
    }
  };

  const handleAddPhoto = () => {
    Alert.alert('Add Photo', 'Choose a photo from your library or take a new one.', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitReport = async () => {
    if (!selectedType || !description.trim()) {
      Alert.alert('Incomplete Report', 'Please select an incident type and provide a description.');
      return;
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert('Invalid Location', 'Please enter a valid latitude and longitude.');
      return;
    }

    setSubmitting(true);
    try {
      const reportData = {
        type: selectedType,
        description: description.trim(),
        latitude: lat,
        longitude: lon,
        timestamp: new Date().toISOString(),
        userId: user?.phone || 'anonymous',
        status: 'pending',
        photos,
      };

      const response = await fetch(`${API_BASE_URL}/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      const responseData = await response.json();

      if (response.ok) {
        const notification = {
        id: typeof responseData.report_id !== 'undefined' ? responseData.report_id : Date.now(),
        };
        addNotification(notification);

        Alert.alert('Report Submitted', 'Thank you for your report. Authorities have been notified.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        throw new Error(responseData.message || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Report submission error:', error);
      Alert.alert('Submission Failed', 'Unable to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F9' }}>
      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <ArrowLeft size={24} color="#4A2E35" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-black text-[#4A2E35]">Report Incident</Text>
            <Text className="text-[#9E7A80] font-medium text-sm">Help keep your community safe</Text>
          </View>
        </View>

        {/* Location Selector */}
        <View className="bg-white p-4 rounded-2xl shadow-sm border border-[#E5B2B9]/50 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <MapPin size={18} color="#D81B60" />
              <Text className="text-[#4A2E35] font-bold text-sm ml-2">Report Location</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-[#4A2E35] font-medium mr-2 text-sm">Use current</Text>
              <Switch
                value={useCurrentLocation}
                onValueChange={setUseCurrentLocation}
                trackColor={{ false: '#E5B2B9', true: '#D81B60' }}
                thumbColor={useCurrentLocation ? '#fff' : '#fff'}
              />
            </View>
          </View>

          <View className="mb-3">
            <Text style={{ letterSpacing: 2 }} className="text-[#4A2E35] text-xs uppercase mb-2">Latitude</Text>
            <TextInput
              className="bg-[#FAF5F5] p-3 rounded-2xl border border-[#E5B2B9]/50 text-[#4A2E35]"
              value={latitude}
              onChangeText={(value) => {
                setLatitude(value);
                setUseCurrentLocation(false);
              }}
              keyboardType="numeric"
              editable={!useCurrentLocation}
              placeholder="Enter latitude"
              placeholderTextColor="#9E7A80"
            />
          </View>
          <View>
            <Text style={{ letterSpacing: 2 }} className="text-[#4A2E35] text-xs uppercase mb-2">Longitude</Text>
            <TextInput
              className="bg-[#FAF5F5] p-3 rounded-2xl border border-[#E5B2B9]/50 text-[#4A2E35]"
              value={longitude}
              onChangeText={(value) => {
                setLongitude(value);
                setUseCurrentLocation(false);
              }}
              keyboardType="numeric"
              editable={!useCurrentLocation}
              placeholder="Enter longitude"
              placeholderTextColor="#9E7A80"
            />
          </View>
        </View>

        <View className="bg-white rounded-3xl overflow-hidden shadow-sm border border-[#E5B2B9]/50 mb-6">
          <View className="px-4 py-3 border-b border-[#E5B2B9]/50">
            <Text className="text-[#4A2E35] font-bold">Tap the map to place the report pin</Text>
            <Text className="text-[#9E7A80] text-xs mt-1">Use current location or choose another spot manually.</Text>
          </View>
          <View style={{ height: 260 }}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: (selectedLocation && selectedLocation.latitude) || (location && location.coords && location.coords.latitude) || 12.9716,
                longitude: (selectedLocation && selectedLocation.longitude) || (location && location.coords && location.coords.longitude) || 77.5946,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
              }}
              onPress={(event) => {
                const coords = event.nativeEvent.coordinate;
                setSelectedLocation(coords);
                setLatitude(String(coords.latitude));
                setLongitude(String(coords.longitude));
                setUseCurrentLocation(false);
              }}
            >
              {(selectedLocation || location) && (
                <Marker
                  coordinate={selectedLocation || location.coords}
                  pinColor="#D81B60"
                />
              )}
            </MapView>
          </View>
        </View>

        {/* Incident Type Selection */}
        <View className="mb-6">
          <Text className="text-[#4A2E35] font-bold text-lg mb-3">Incident Type</Text>
          <View className="flex-row flex-wrap">
            {incidentTypes.map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setSelectedType(type)}
                className={`mr-2 mb-2 px-4 py-2 rounded-full border ${
                  selectedType === type 
                    ? 'bg-[#D81B60] border-[#D81B60]' 
                    : 'bg-white border-[#E5B2B9]/50'
                }`}
              >
                <Text className={`text-sm font-medium ${
                  selectedType === type ? 'text-white' : 'text-[#4A2E35]'
                }`}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View className="mb-6">
          <Text className="text-[#4A2E35] font-bold text-lg mb-3">Description</Text>
          <TextInput
            className="bg-white p-4 rounded-2xl shadow-sm border border-[#E5B2B9]/50 text-[#4A2E35] min-h-[120px]"
            placeholder="Describe what happened..."
            placeholderTextColor="#9E7A80"
            multiline
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        </View>

        {/* Additional Options */}
        <View className="mb-6">
          <Text className="text-[#4A2E35] font-bold text-lg mb-3">Photos (optional)</Text>
          <TouchableOpacity
            onPress={handleAddPhoto}
            className="bg-white p-4 rounded-2xl shadow-sm border border-[#E5B2B9]/50 items-center"
          >
            <Camera size={24} color="#D81B60" />
            <Text className="text-[#4A2E35] font-medium text-sm mt-2">Add Photo</Text>
          </TouchableOpacity>

          {photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
              {photos.map((uri, index) => (
                <Image
                  key={`${uri}-${index}`}
                  source={{ uri }}
                  className="w-28 h-28 rounded-3xl mr-3"
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <Text className="text-[#9E7A80] text-sm mt-3">You can attach photos from your camera or gallery.</Text>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          onPress={submitReport}
          disabled={submitting}
          className="mb-10"
        >
          <LinearGradient 
            colors={submitting ? ['#E5B2B9', '#D81B60'] : ['#D81B60', '#E5B2B9']} 
            className="p-4 rounded-3xl shadow-lg items-center"
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Send size={20} color="white" />
                <Text className="text-white font-bold text-lg ml-2">Submit Report</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}