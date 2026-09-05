// FakeCallScreen — a decoy "incoming call" UI you can trigger to excuse yourself
// from an uncomfortable situation. Two phases: ringing (Accept/Decline) and an
// in-call state with an elapsed timer and inert Mute/Speaker/Keypad buttons that
// look real but do nothing. No backend call, no GlobalContext state — this is a
// self-contained, ephemeral screen (see AppNavigator.js for how it's triggered).
//
// No ringtone asset exists in this repo yet (see plan notes) — this ships
// vibration-only for now; swap in an expo-av Audio.Sound.createAsync(...) call
// here later without touching anything else if/when a real ringtone file is added.
import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, Text, TouchableOpacity, Image, Vibration, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Grid3x3, User } from 'lucide-react-native';
import { GlobalContext } from '../contexts/GlobalContext';

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function FakeCallScreen() {
  const navigation = useNavigation();
  const { userProfile } = useContext(GlobalContext);
  const [phase, setPhase] = useState('ringing'); // 'ringing' | 'active'
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const timerRef = useRef(null);

  const callerName = userProfile.fakeCallerName?.trim() || 'Mom';
  const callerPhoto = userProfile.fakeCallerPhoto;

  // Repeating buzz while "ringing" — silent (vibration only, no audio asset yet),
  // which is actually the more discreet option for the situation this exists for.
  useEffect(() => {
    Vibration.vibrate([0, 500, 1000], true);
    return () => Vibration.cancel();
  }, []);

  // Hardware back should act like Decline/End, not silently pop the screen and
  // leave the illusion half-finished.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleEndCall();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'active') return;
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const handleAccept = () => {
    Vibration.cancel();
    setElapsed(0);
    setPhase('active');
  };

  const handleEndCall = () => {
    Vibration.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    navigation.goBack();
  };

  const controlButtons = [
    { key: 'mute', Icon: muted ? MicOff : Mic, label: 'mute', active: muted, onPress: () => setMuted((m) => !m) },
    { key: 'keypad', Icon: Grid3x3, label: 'keypad', active: false, onPress: () => {} },
    { key: 'speaker', Icon: Volume2, label: 'speaker', active: speakerOn, onPress: () => setSpeakerOn((s) => !s) },
  ];

  return (
    <LinearGradient colors={['#232326', '#000000']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 32 }}>
        <View style={{ alignItems: 'center', marginTop: 32 }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 10, letterSpacing: 0.5 }}>
            {phase === 'ringing' ? 'Incoming call' : formatElapsed(elapsed)}
          </Text>
          <View
            style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              overflow: 'hidden',
              marginBottom: 20,
              backgroundColor: '#3A3A3C',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {callerPhoto ? (
              <Image source={{ uri: callerPhoto }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <User size={64} color="#8E8E93" />
            )}
          </View>
          <Text style={{ color: 'white', fontSize: 32, fontWeight: '600' }}>{callerName}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 4 }}>mobile</Text>
        </View>

        {phase === 'active' && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 30 }}>
            {controlButtons.map(({ key, Icon, label, active, onPress }) => (
              <View key={key} style={{ alignItems: 'center', marginHorizontal: 18, marginBottom: 20 }}>
                <TouchableOpacity
                  onPress={onPress}
                  activeOpacity={0.7}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 34,
                    backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={26} color={active ? '#000' : '#fff'} />
                </TouchableOpacity>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 }}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        <View
          style={{
            flexDirection: 'row',
            justifyContent: phase === 'ringing' ? 'space-around' : 'center',
            paddingHorizontal: 50,
          }}
        >
          {phase === 'ringing' && (
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity
                onPress={handleEndCall}
                activeOpacity={0.8}
                style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' }}
              >
                <PhoneOff size={30} color="white" />
              </TouchableOpacity>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 8 }}>Decline</Text>
            </View>
          )}
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
              onPress={phase === 'ringing' ? handleAccept : handleEndCall}
              activeOpacity={0.8}
              style={{
                width: 70,
                height: 70,
                borderRadius: 35,
                backgroundColor: phase === 'ringing' ? '#34C759' : '#FF3B30',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {phase === 'ringing' ? <Phone size={30} color="white" /> : <PhoneOff size={30} color="white" />}
            </TouchableOpacity>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 8 }}>
              {phase === 'ringing' ? 'Accept' : 'End'}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
