import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldAlert, XCircle, PhoneCall, AlertTriangle, Users } from 'lucide-react-native';
import * as SMS from 'expo-sms';

const { width, height } = Dimensions.get('window');

export default function SOSScreen() {
  const [countdown, setCountdown] = useState(15);
  const [status, setStatus] = useState('Holding...');
  const [dispatching, setDispatching] = useState(false);
  const hasTriggered = useRef(false);
  const navigation = useNavigation();
  const { location, userProfile, activeSOS, triggerSOS, cancelSOS, sosError } = useContext(GlobalContext);
  const pulseAnim = new Animated.Value(1);

  const sendEmergencySMS = async () => {
    const phone = userProfile.emergencyContactPhone;
    if (!phone || !location) return;
    const mapsLink = `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;
    const message = `EMERGENCY! I need immediate help. My live location: ${mapsLink}`;
    try {
      // expo-sms targets the device's default SMS app directly (Android
      // Intent.ACTION_SENDTO + "smsto:"), unlike Linking.openURL('sms:...')
      // which fires a generic intent that WhatsApp/Truecaller also claim,
      // forcing a chooser dialog on the user.
      const available = await SMS.isAvailableAsync();
      if (!available) {
        console.error('SMS composer is not available on this device.');
        return;
      }
      await SMS.sendSMSAsync([phone], message);
    } catch (err) {
      console.error('Failed to open SMS composer:', err);
    }
  };

  const dispatchSOS = async () => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;
    setDispatching(true);
    await triggerSOS();
    setDispatching(false);
    await sendEmergencySMS();
    setStatus('Alerting emergency contact & broadcasting your location!');
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    if (hasTriggered.current) return;
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else {
      dispatchSOS();
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleTriggerNow = () => {
    setCountdown(0);
    dispatchSOS();
  };

  const handleCancel = () => {
    cancelSOS();
    navigation.goBack();
  };

  return (
    <LinearGradient colors={['#D81B60', '#E5B2B9']} className="flex-1">
      <SafeAreaView className="flex-1 items-center justify-between py-12 px-8">

        {/* Header */}
        <View className="items-center">
           <Text className="text-white text-3xl font-black tracking-widest uppercase italic">Emergency SOS</Text>
           <Text className="text-white/80 font-bold mt-2">Help is on the way</Text>
        </View>

        {/* Pulse Button Container */}
        <View className="items-center justify-center">
          <Animated.View
            style={{ transform: [{ scale: pulseAnim }] }}
            className="w-[240px] h-[240px] rounded-full bg-white/20 items-center justify-center border border-white/30"
          >
            <View className="w-[180px] h-[180px] rounded-full bg-white items-center justify-center shadow-2xl">
              <Text className="text-6xl font-black text-[#D81B60]">{countdown > 0 ? countdown : '!'}</Text>
            </View>
          </Animated.View>
        </View>

        {/* Status Section */}
        <View className="items-center w-full">
           <Text className="text-white text-xl font-bold text-center mb-4">{dispatching ? 'Dispatching...' : status}</Text>

           <View className="flex-row space-x-4 mb-8">
              <View className="bg-white/20 p-3 rounded-2xl items-center flex-1">
                 <ShieldAlert size={28} color="white" />
                 <Text className="text-white text-xs font-bold mt-2">Authorities</Text>
              </View>
              <View className="bg-white/20 p-3 rounded-2xl items-center flex-1 border border-white/40">
                 <Users size={28} color="white" />
                 <Text className="text-white text-xs font-bold mt-2">Community</Text>
              </View>
              <View className="bg-white/20 p-3 rounded-2xl items-center flex-1">
                 <PhoneCall size={28} color="white" />
                 <Text className="text-white text-xs font-bold mt-2">Contacts</Text>
              </View>
           </View>

           {countdown > 0 && (
             <Text className="text-white/60 font-medium mb-6 italic">Activating in {countdown}s</Text>
           )}

           {activeSOS?.status === 'active' && !userProfile.emergencyContactPhone && (
             <Text className="text-white bg-black/25 text-xs text-center px-4 py-2 rounded-xl mb-4 max-w-[85%]">
               No emergency contact on file — add one from your profile to auto-notify them.
             </Text>
           )}

           {sosError && (
             <Text className="text-white bg-black/25 text-xs text-center px-4 py-2 rounded-xl mb-4 max-w-[85%]">
               {sosError}
             </Text>
           )}

           {activeSOS?.status === 'responding' && (
             <Text className="text-white bg-black/25 text-sm text-center px-4 py-3 rounded-xl mb-4 max-w-[85%] font-bold">
               Community Responder {activeSOS.responder_name} ({activeSOS.responder_phone}) is en route!
             </Text>
           )}

           {countdown > 0 && (
             <TouchableOpacity onPress={handleTriggerNow} className="w-full bg-black h-14 rounded-full items-center justify-center mb-4">
                <Text className="text-white text-lg font-black uppercase">SOS Now</Text>
             </TouchableOpacity>
           )}

           <TouchableOpacity
             onPress={handleCancel}
             className="w-full bg-white/10 border border-white/30 h-16 rounded-full flex-row items-center justify-center"
           >
              <XCircle size={24} color="white" className="mr-3" />
              <Text className="text-white text-xl font-black uppercase">I'm Safe, Cancel</Text>
           </TouchableOpacity>
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
}
