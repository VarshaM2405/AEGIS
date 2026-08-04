import React, { useContext, useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { GlobalContext } from '../contexts/GlobalContext';
import { LinearGradient } from 'expo-linear-gradient';
import { User, PhoneForwarded, X, Info, Sparkles } from 'lucide-react-native';

const safetyTips = [
  'Share your live location during late-night travel.',
  'Trust your instincts. If something feels wrong, leave immediately.',
  'Keep your trusted contacts updated.',
  'Avoid isolated shortcuts after dark.',
  'Stay in well-lit public places whenever possible.',
  'Charge your phone before travelling.',
  'Inform someone before long solo journeys.',
  'Use verified transport whenever possible.',
];

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, setUser, logout, userProfile, setUserProfile, location } = useContext(GlobalContext);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [nameValue, setNameValue] = useState(userProfile.name || user?.name || '');
  const [cityName, setCityName] = useState('Location unavailable');
  const [tip, setTip] = useState('Stay connected and stay safe.');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isEmergencyContactSet = Boolean(userProfile.emergencyContactPhone?.trim());
  const displayName = userProfile.name || user?.name || 'Aegis User';
  const profilePicture = userProfile.profilePicture;

  useEffect(() => {
    setTip(safetyTips[Math.floor(Math.random() * safetyTips.length)]);
    Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, friction: 10, tension: 80 }).start();
  }, []);

  useEffect(() => {
    setNameValue(userProfile.name || user?.name || '');
  }, [userProfile.name, user?.name]);

  useEffect(() => {
    const fetchCity = async () => {
      if (!location?.coords) {
        setCityName('Location unavailable');
        return;
      }
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (place && (place.city || place.region || place.subregion)) {
          setCityName(place.city || place.subregion || place.region || 'Location unavailable');
        } else {
          setCityName('Location unavailable');
        }
      } catch (err) {
        console.error('Reverse geocode failed:', err);
        setCityName('Location unavailable');
      }
    };
    fetchCity();
  }, [location?.coords]);

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow image access to change your profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets?.length > 0) {
        setUserProfile((prev) => ({ ...prev, profilePicture: result.assets[0].uri }));
      }
    } catch (err) {
      console.error('Image picker failed:', err);
    }
  };

  const openContactModal = () => {
    setContactName(userProfile.emergencyContactName || '');
    setContactPhone(userProfile.emergencyContactPhone || '');
    setContactModalVisible(true);
  };

  const saveContact = () => {
    if (contactPhone.trim().length < 7) {
      return Alert.alert('Missing Info', 'Please add a valid emergency contact number.');
    }
    setUserProfile((prev) => ({
      ...prev,
      emergencyContactName: contactName.trim(),
      emergencyContactPhone: contactPhone.trim(),
    }));
    setContactModalVisible(false);
  };

  const openEditModal = () => {
    setNameValue(userProfile.name || user?.name || '');
    setEditModalVisible(true);
  };

  const saveProfile = () => {
    if (!nameValue.trim()) {
      return Alert.alert('Name Required', 'Please enter your display name.');
    }
    const trimmed = nameValue.trim();
    setUserProfile((prev) => ({ ...prev, name: trimmed }));
    if (user) {
      setUser({ ...user, name: trimmed });
    }
    setEditModalVisible(false);
  };

  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const contactSubtitle = isEmergencyContactSet ? 'Ready to receive alerts from your network.' : 'No contact set yet.';
  const heroSubtitle = 'Stay aware • Stay connected • Stay safe';

  return (
    <SafeAreaView className="flex-1 bg-[#FDF8F9]">
      <ScrollView className="flex-1 px-6 pt-8" showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={pickImage}
          activeOpacity={0.8}
          className="items-center mb-8"
        >
          <View className="relative w-36 h-36 rounded-full border-4 border-white shadow-2xl overflow-hidden mb-4">
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} className="w-full h-full" />
            ) : (
              <LinearGradient colors={[ '#F7D6DD', '#FDE7EE' ]} className="flex-1 items-center justify-center">
                <User size={72} color="#D81B60" />
              </LinearGradient>
            )}
          </View>
          <Text className="text-3xl font-black text-[#4A2E35]">{displayName}</Text>
          <Text className="text-[#9E7A80] font-semibold uppercase text-[11px] mt-2 tracking-[1px]">
            {cityName}
          </Text>
        </TouchableOpacity>

        <Animated.View style={{ opacity: fadeAnim }} className="mb-6 rounded-[32px] overflow-hidden shadow-xl">
          <LinearGradient
            colors={[ '#D81B60', '#BB1C51' ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="p-6"
          >
            <View className="bg-white/12 rounded-3xl px-4 py-3 mb-5 border border-white/30">
              <Text className="text-white uppercase text-[10px] tracking-[1px] font-bold">Safety Tip of the Day</Text>
            </View>
            <Text className="text-white text-2xl font-black leading-tight mb-4">
              ~ "{tip}"
            </Text>
            <Text className="text-white/85 text-sm leading-6">
              {heroSubtitle}
            </Text>
          </LinearGradient>
        </Animated.View>

        <View className="bg-white rounded-[32px] p-6 shadow-sm border border-[#E5B2B9]/50 mb-6">
          <View className="mb-4">
            <Text className="text-[#4A2E35] font-black text-xl">Profile</Text>
            <Text className="text-[#9E7A80] text-sm mt-1 leading-5">
              Keep your profile up to date for trusted community use.
            </Text>
          </View>
          <View className="rounded-[28px] border border-[#E5B2B9]/70 bg-[#FDF8F9] p-5">
            <Text className="text-[#9E7A80] uppercase text-[10px] font-bold mb-3">Display Name</Text>
            <Text className="text-[#4A2E35] text-lg font-semibold">{displayName}</Text>
            <Text className="text-[#9E7A80] text-sm mt-3">{cityName}</Text>
          </View>
          <TouchableOpacity onPress={openEditModal} className="mt-5 bg-[#FDF8F9] border border-[#D81B6050] rounded-3xl py-4 items-center">
            <Text className="text-[#D81B60] font-bold">Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-[32px] p-6 shadow-sm border border-[#E5B2B9]/50 mb-6">
          <View className="flex-row items-center mb-4">
            <View className="bg-[#D81B6050] p-3 rounded-3xl mr-4">
              <PhoneForwarded size={22} color="#D81B60" />
            </View>
            <View>
              <Text className="text-[#4A2E35] font-black text-lg">Emergency Contact</Text>
              <Text className="text-[#9E7A80] text-sm mt-1">{contactSubtitle}</Text>
            </View>
          </View>
          <View className="rounded-[28px] border border-[#E5B2B9]/70 bg-[#FDF8F9] p-5">
            <Text className="text-[#9E7A80] uppercase text-[10px] font-bold mb-2">Contact</Text>
            <Text className="text-[#4A2E35] text-lg font-semibold">
              {userProfile.emergencyContactName || 'No contact name'}
            </Text>
            <Text className="text-[#4A2E35] text-base mt-1">
              {userProfile.emergencyContactPhone || 'No phone number added'}
            </Text>
          </View>
          <TouchableOpacity onPress={openContactModal} className="mt-5 bg-[#FDF8F9] border border-[#D81B6050] rounded-3xl py-4 items-center">
            <Text className="text-[#D81B60] font-bold">Edit Contact</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-[#FEF1F5] rounded-[32px] p-6 shadow-sm border border-[#F4C9D3]/60 mb-8">
          <View className="flex-row items-center mb-4">
            <View className="bg-[#F7D6DE] p-3 rounded-3xl mr-4">
              <Info size={22} color="#D81B60" />
            </View>
            <View className="flex-1">
              <Text className="text-[#4A2E35] font-black text-lg">About AEGIS</Text>
              <Text className="text-[#9E7A80] text-sm mt-1 flex-shrink">
                A trusted companion for safer travel.
              </Text>
            </View>
          </View>
          <View className="bg-white rounded-[28px] p-5 border border-[#F5B6C1]">
            <Text className="text-[#4A2E35] text-sm leading-6 mb-4">
              AEGIS blends live routing, crime analytics, and community response into a single safety companion.
            </Text>
            <View className="space-y-2">
              <Text className="text-[#9E7A80] text-sm leading-6">• Real-time route safety guidance</Text>
              <Text className="text-[#9E7A80] text-sm leading-6">• Emergency contact and SOS coordination</Text>
              <Text className="text-[#9E7A80] text-sm leading-6">• Context-aware alerts for confident journeys</Text>
            </View>
          </View>
          <Text className="text-[#9E7A80] text-[10px] uppercase tracking-[1px] mt-5">Version 1.0</Text>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          className="bg-[#D81B60] rounded-3xl py-5 items-center mb-10 shadow-xl"
        >
          <Text className="text-white text-lg font-black">Log Out</Text>
        </TouchableOpacity>

        <View className="items-center mb-10">
          <Text className="text-[#9E7A80] font-semibold text-sm mb-2">Stay Safe.</Text>
          <Text className="text-[#9E7A80] text-xs text-center leading-5">AEGIS is always here whenever you need it.</Text>
          <Text className="text-[#9E7A80] text-[10px] uppercase tracking-[1px] mt-4">Version 1.0</Text>
          <Text className="text-[#9E7A80] text-[10px] mt-1">Made for safer journeys.</Text>
        </View>
      </ScrollView>

      <Modal visible={contactModalVisible} animationType="slide" transparent onRequestClose={() => setContactModalVisible(false)}>
        <View className="flex-1 bg-black/50 justify-center px-8">
          <View className="bg-white rounded-[32px] p-6">
            <View className="flex-row items-center justify-between mb-2">
<Text className="text-xl font-black text-[#4A2E35]">Trusted Contact</Text>
              <TouchableOpacity onPress={() => setContactModalVisible(false)}>
                <X size={22} color="#9E7A80" />
              </TouchableOpacity>
            </View>
            <Text className="text-[#9E7A80] text-xs mb-5">
              We'll text them your live location during an active alert.
            </Text>

            <View className="bg-[#FDF8F9] h-16 rounded-2xl flex-row items-center px-5 border border-[#E5B2B9]/50 mb-4">
              <User size={20} color="#DDA7A5" />
              <TextInput
                placeholder="Contact Name"
                className="flex-1 ml-4 text-lg font-medium h-full"
                value={contactName}
                onChangeText={setContactName}
              />
            </View>
            <View className="bg-[#FDF8F9] h-16 rounded-2xl flex-row items-center px-5 border border-[#E5B2B9]/50 mb-6">
              <PhoneForwarded size={20} color="#DDA7A5" />
              <TextInput
                placeholder="Contact Phone Number"
                className="flex-1 ml-4 text-lg font-medium h-full"
                keyboardType="phone-pad"
                value={contactPhone}
                onChangeText={setContactPhone}
                maxLength={15}
              />
            </View>

            <TouchableOpacity onPress={saveContact} activeOpacity={0.8}>
              <LinearGradient colors={['#E5B2B9', '#D81B60']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="h-16 rounded-2xl items-center justify-center shadow-lg">
                <Text className="text-white text-lg font-bold">Save Contact</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
        <View className="flex-1 bg-black/50 justify-center px-8">
          <View className="bg-white rounded-[32px] p-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xl font-black text-[#4A2E35]">Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={22} color="#9E7A80" />
              </TouchableOpacity>
            </View>
            <Text className="text-[#9E7A80] text-xs mb-5">
              Update your display name and keep your profile fresh.
            </Text>

            <View className="bg-[#FDF8F9] h-16 rounded-2xl flex-row items-center px-5 border border-[#E5B2B9]/50 mb-6">
              <User size={20} color="#DDA7A5" />
              <TextInput
                placeholder="Display Name"
                className="flex-1 ml-4 text-lg font-medium h-full"
                value={nameValue}
                onChangeText={setNameValue}
              />
            </View>

            <TouchableOpacity onPress={saveProfile} activeOpacity={0.8}>
              <LinearGradient colors={['#E5B2B9', '#D81B60']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="h-16 rounded-2xl items-center justify-center shadow-lg">
                <Text className="text-white text-lg font-bold">Save Profile</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
