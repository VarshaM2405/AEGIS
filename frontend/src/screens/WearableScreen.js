import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Watch, Heart, ShieldCheck, Zap, Bluetooth, ChevronRight } from 'lucide-react-native';

export default function WearableScreen() {
  const [pulseAnim] = useState(new Animated.Value(1));
  const [bpm, setBpm] = useState(72);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    const interval = setInterval(() => {
      setBpm(prev => prev + (Math.random() > 0.5 ? 1 : -1));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-[#FDF8F9]">
      <View className="px-6 pt-8">
        <Text className="text-3xl font-bold text-[#4A2E35] mb-2">Watch <Text className="text-[#E5B2B9]">Sync</Text></Text>
        <Text className="text-[#9E7A80] font-medium mb-10">Real-time health & safety monitoring</Text>

        {/* Device Connectivity Card */}
        <View className="bg-white p-6 rounded-[32px] shadow-sm border border-[#E5B2B9]50 flex-row items-center justify-between mb-8">
          <View className="flex-row items-center">
            <View className="bg-[#E5B2B920] p-4 rounded-2xl mr-4">
              <Watch size={28} color="#E5B2B9" />
            </View>
            <View>
              <Text className="text-[#4A2E35] font-bold text-lg">Apple Watch S9</Text>
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                <Text className="text-[#9E7A80] text-xs font-bold uppercase">Connected</Text>
              </View>
            </View>
          </View>
          <Bluetooth size={20} color="#E5B2B9" />
        </View>

        {/* Pulse UI */}
        <View className="items-center justify-center py-10">
          <Animated.View 
            style={{ transform: [{ scale: pulseAnim }] }}
            className="w-64 h-64 rounded-full bg-[#E5B2B910] items-center justify-center border border-[#E5B2B9]20"
          >
            <View className="w-48 h-48 rounded-full bg-white shadow-xl items-center justify-center">
              <LinearGradient
                colors={['#E5B2B920', '#D81B6010']}
                className="absolute inset-0 rounded-full"
              />
              <Heart size={40} color="#D81B60" fill="#D81B60" />
              <Text className="text-5xl font-black text-[#4A2E35] mt-2">{bpm}</Text>
              <Text className="text-[#9E7A80] font-bold text-xs uppercase tracking-widest">BPM</Text>
            </View>
          </Animated.View>
        </View>

        {/* Stats Grid */}
        <View className="flex-row space-x-4 mb-8">
          <View className="flex-1 bg-white p-6 rounded-3xl shadow-sm border border-[#E5B2B9]50 items-center">
            <ShieldCheck size={28} color="#34C759" className="mb-3" />
            <Text className="text-xs text-[#9E7A80] font-bold uppercase mb-1">Status</Text>
            <Text className="font-bold text-[#4A2E35]">Protected</Text>
          </View>
          <View className="flex-1 bg-white p-6 rounded-3xl shadow-sm border border-[#E5B2B9]50 items-center">
            <Zap size={28} color="#FFCC00" className="mb-3" />
            <Text className="text-xs text-[#9E7A80] font-bold uppercase mb-1">Activity</Text>
            <Text className="font-bold text-[#4A2E35]">Steady</Text>
          </View>
        </View>

        {/* Remote SOS Trigger */}
        <TouchableOpacity 
          activeOpacity={0.8}
          className="bg-[#D81B60] h-16 rounded-full flex-row items-center justify-center shadow-lg shadow-[#D81B6050]"
        >
          <Text className="text-white text-lg font-bold">Configure Watch SOS</Text>
          <ChevronRight size={20} color="white" className="ml-2" />
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}
