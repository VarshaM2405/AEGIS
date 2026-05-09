import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Animated, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldAlert, XCircle, PhoneCall, AlertTriangle, Users } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

export default function SOSScreen() {
  const [countdown, setCountdown] = useState(15);
  const [status, setStatus] = useState("Holding...");
  const navigation = useNavigation();
  const { toggleSOS } = useContext(GlobalContext);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else {
      setStatus("Broadcasting to nearest community members & local authorities...");
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleCancel = () => {
    toggleSOS();
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
           <Text className="text-white text-xl font-bold text-center mb-4">{status}</Text>
           
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
             <Text className="text-white/60 font-medium mb-10 italic">Activating in {countdown}s</Text>
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
