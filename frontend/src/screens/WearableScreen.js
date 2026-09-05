import React, { useContext, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Watch, Heart, ShieldCheck, Zap, Bluetooth, ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';

export default function WearableScreen() {
  const navigation = useNavigation();
  const { userProfile, setUserProfile, bleStatus, bleDevices, connectToBleDevice, currentBpm } = useContext(GlobalContext);
  const [pulseAnim] = useState(new Animated.Value(1));

  const monitoringEnabled = !!userProfile.wearableMonitoringEnabled;

  // The toggle being on just means the app WANTS to monitor — bleStatus (written by
  // HeartRateMonitor via useAegisMonitoring(), see GlobalContext.js) is the actual truth
  // about whether a wearable is connected. Surfaced here so this screen doesn't lie about
  // "active" while still scanning or after a Bluetooth error.
  const statusDisplay = !monitoringEnabled
    ? { color: 'bg-gray-300', label: 'Monitoring off' }
    : bleStatus === 'connected'
    ? { color: 'bg-green-500', label: 'Connected' }
    : bleStatus === 'connecting'
    ? { color: 'bg-yellow-400', label: 'Connecting…' }
    : bleStatus === 'error'
    ? { color: 'bg-red-500', label: 'Bluetooth error' }
    : bleStatus === 'disconnected'
    ? { color: 'bg-orange-400', label: 'Disconnected' }
    : { color: 'bg-yellow-400', label: 'Scanning…' };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Flips the toggle the auto-distress monitor (mounted once near the app
  // root, see App.js / useAegisMonitoring in GlobalContext.js) watches — it
  // starts/stops the accelerometer + BLE heart-rate scan in response, so no
  // second monitoring instance is spun up here.
  const toggleMonitoring = (value) => {
    setUserProfile((prev) => ({ ...prev, wearableMonitoringEnabled: value }));
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FDF8F9]">
      <ScrollView
        className="px-6 pt-8"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} className="mb-4 self-start" activeOpacity={0.7}>
          <ChevronLeft size={26} color="#4A2E35" />
        </TouchableOpacity>

        <Text className="text-3xl font-bold text-[#4A2E35] mb-2">Watch <Text className="text-[#E5B2B9]">Sync</Text></Text>
        <Text className="text-[#9E7A80] font-medium mb-10">Real-time health & safety monitoring</Text>

        {/* Device Connectivity Card */}
        <View className="bg-white p-6 rounded-[32px] shadow-sm border border-[#E5B2B9]/50 flex-row items-center justify-between mb-8">
          <View className="flex-row items-center">
            <View className="bg-[#E5B2B920] p-4 rounded-2xl mr-4">
              <Watch size={28} color="#E5B2B9" />
            </View>
            <View>
              <Text className="text-[#4A2E35] font-bold text-lg">Heart-rate wearable</Text>
              <View className="flex-row items-center">
                <View className={`w-2 h-2 rounded-full mr-2 ${statusDisplay.color}`} />
                <Text className="text-[#9E7A80] text-xs font-bold uppercase">
                  {statusDisplay.label}
                </Text>
              </View>
            </View>
          </View>
          <Bluetooth size={20} color="#E5B2B9" />
        </View>

        {/* Nearby devices — tap one to connect. Populated by HeartRateMonitor's scan
            (see GlobalContext's useAegisMonitoring); only shown while monitoring is on. */}
        {monitoringEnabled && (
          <View className="bg-white rounded-[32px] shadow-sm border border-[#E5B2B9]/50 mb-8 overflow-hidden">
            <Text className="text-[#9E7A80] text-xs font-bold uppercase px-6 pt-5 pb-2">
              Nearby heart-rate devices
            </Text>
            {bleDevices.length === 0 ? (
              <Text className="text-[#9E7A80] text-sm px-6 pb-5 leading-5">
                {bleStatus === 'error'
                  ? 'Bluetooth error — see status above.'
                  : 'Searching for ANY nearby Bluetooth device (not just heart-rate ones)… if this never fills in, your phone is finding zero Bluetooth devices at all — check Bluetooth is on and try moving closer to the other phone.'}
              </Text>
            ) : (
              bleDevices.map((device) => {
                // Disabled (not just visually, but actually not calling connectToBleDevice)
                // while a connection attempt is already in flight — a rapid double-tap here
                // used to fire two overlapping connect() calls that interrupted each other
                // and looped forever. HeartRateMonitor now guards against that too, but no
                // reason to let the UI invite it in the first place.
                const busy = bleStatus === 'connecting';
                return (
                  <TouchableOpacity
                    key={device.id}
                    onPress={() => connectToBleDevice(device.id)}
                    disabled={busy}
                    activeOpacity={0.7}
                    className="flex-row items-center justify-between px-6 py-4 border-t border-[#E5B2B9]/30"
                    style={busy ? { opacity: 0.5 } : undefined}
                  >
                    <View className="flex-1 pr-4">
                      <Text className="text-[#4A2E35] font-bold">{device.name}</Text>
                      <Text className="text-[#9E7A80] text-xs">
                        {device.id} · {device.rssi != null ? `${device.rssi} dBm` : 'no signal reading'}
                      </Text>
                      {device.hasHeartRateService && (
                        <Text className="text-green-600 text-xs font-bold mt-0.5">✓ Advertises Heart Rate service</Text>
                      )}
                    </View>
                    <Text className="text-[#D81B60] font-bold text-xs uppercase">
                      {busy ? 'Connecting…' : 'Connect'}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Pulse UI */}
        <View className="items-center justify-center py-10">
          <Animated.View
            style={{ transform: [{ scale: pulseAnim }] }}
            className="w-64 h-64 rounded-full bg-[#E5B2B910] items-center justify-center border border-[#E5B2B9]/20"
          >
            <View className="w-48 h-48 rounded-full bg-white shadow-xl items-center justify-center">
              <LinearGradient
                colors={['#E5B2B920', '#D81B6010']}
                className="absolute inset-0 rounded-full"
              />
              <Heart size={40} color="#D81B60" fill="#D81B60" />
              <Text className="text-5xl font-black text-[#4A2E35] mt-2">{currentBpm}</Text>
              <Text style={{ letterSpacing: 2 }} className="text-[#9E7A80] font-bold text-xs uppercase">BPM</Text>
            </View>
          </Animated.View>
        </View>

        {/* Stats Grid */}
        <View className="flex-row space-x-4 mb-8">
          <View className="flex-1 bg-white p-6 rounded-3xl shadow-sm border border-[#E5B2B9]/50 items-center">
            <ShieldCheck size={28} color={monitoringEnabled ? '#34C759' : '#DDA7A5'} className="mb-3" />
            <Text className="text-xs text-[#9E7A80] font-bold uppercase mb-1">Status</Text>
            <Text className="font-bold text-[#4A2E35]">{monitoringEnabled ? 'Protected' : 'Not watching'}</Text>
          </View>
          <View className="flex-1 bg-white p-6 rounded-3xl shadow-sm border border-[#E5B2B9]/50 items-center">
            <Zap size={28} color="#FFCC00" className="mb-3" />
            <Text className="text-xs text-[#9E7A80] font-bold uppercase mb-1">Activity</Text>
            <Text className="font-bold text-[#4A2E35]">Steady</Text>
          </View>
        </View>

        {/* Monitoring toggle */}
        <View className="bg-white p-6 rounded-[32px] shadow-sm border border-[#E5B2B9]/50 mb-8">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-[#4A2E35] font-bold text-lg mb-1">Automatic distress detection</Text>
              <Text className="text-[#9E7A80] text-sm leading-5">
                Watches your wearable's heart rate and your phone's motion. If both suggest
                distress for a few seconds — or a fall is detected — AEGIS vibrates and starts
                a 10-second countdown before sending an SOS, giving you a chance to cancel.
              </Text>
            </View>
            <Switch
              value={monitoringEnabled}
              onValueChange={toggleMonitoring}
              trackColor={{ false: '#E5B2B950', true: '#D81B6080' }}
              thumbColor={monitoringEnabled ? '#D81B60' : '#f4f3f4'}
            />
          </View>
        </View>

        <Text className="text-[#9E7A80] text-xs text-center mb-6 leading-5">
          Requires a Bluetooth heart-rate strap or band (standard Heart Rate GATT profile) and
          works best in the foreground with location and Bluetooth permissions granted.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
