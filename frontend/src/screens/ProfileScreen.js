import React, { useContext } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Image } from 'react-native';
import { GlobalContext } from '../contexts/GlobalContext';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Shield, MapPin, PhoneForwarded, Settings, ChevronRight, LogOut, Award } from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, logout } = useContext(GlobalContext);

  const stats = [
    { label: 'Shielded km', value: '124', icon: Shield, color: '#D81B60' },
    { label: 'Trust Score', value: '4.9', icon: Award, color: '#E5B2B9' },
    { label: 'Reports', value: '8', icon: MapPin, color: '#C71585' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#FDF8F9]">
      <ScrollView className="flex-1 px-6 pt-8">
        
        {/* Profile Header */}
        <View className="items-center mb-10">
          <View className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden mb-4">
             <LinearGradient colors={['#E5B2B920', '#D81B6020']} className="flex-1 items-center justify-center">
                <User size={64} color="#D81B60" />
             </LinearGradient>
          </View>
          <Text className="text-2xl font-black text-[#4A2E35]">{user?.name || "The Explorer"}</Text>
          <Text className="text-[#9E7A80] font-bold uppercase tracking-wider text-xs mt-1">{user?.area || "Bangalore, IN"}</Text>
        </View>

        {/* Actionable Stats */}
        <View className="flex-row justify-between mb-10">
          {stats.map((s, i) => (
            <View key={i} className="items-center">
               <View style={{ backgroundColor: s.color + '15' }} className="p-4 rounded-2xl mb-2">
                 <s.icon size={24} color={s.color} />
               </View>
               <Text className="font-black text-[#4A2E35] text-lg">{s.value}</Text>
               <Text className="text-[#9E7A80] text-[10px] font-bold uppercase">{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Section: Account & Safety */}
        <Text className="text-[#9E7A80] font-bold uppercase tracking-widest text-xs mb-4 ml-2">Safety Configuration</Text>
        <View className="bg-white rounded-[32px] shadow-sm border border-[#E5B2B9]50 overflow-hidden mb-8">
          <TouchableOpacity className="flex-row items-center justify-between p-5 border-b border-gray-50">
            <View className="flex-row items-center">
              <View className="bg-blue-50 p-2 rounded-xl mr-4"><PhoneForwarded size={20} color="#007AFF" /></View>
              <Text className="font-bold text-[#4A2E35]">Emergency Contacts</Text>
            </View>
            <ChevronRight size={18} color="#D1D5DB" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center justify-between p-5 border-b border-gray-50">
            <View className="flex-row items-center">
              <View className="bg-purple-50 p-2 rounded-xl mr-4"><Shield size={20} color="#D81B60" /></View>
              <Text className="font-bold text-[#4A2E35]">Shield Sensitivity</Text>
            </View>
            <ChevronRight size={18} color="#D1D5DB" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center justify-between p-5">
            <View className="flex-row items-center">
              <View className="bg-orange-50 p-2 rounded-xl mr-4"><Settings size={20} color="#FF9500" /></View>
              <Text className="font-bold text-[#4A2E35]">Preferences</Text>
            </View>
            <ChevronRight size={18} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity 
          onPress={logout}
          className="bg-white h-16 rounded-3xl border border-red-50 flex-row items-center justify-center mb-12"
        >
          <LogOut size={20} color="#FF3B30" className="mr-2" />
          <Text className="text-[#FF3B30] font-bold text-lg">Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
