import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Animated, Pressable, SafeAreaView } from 'react-native';
import { Heart, Bandage, AlertTriangle, User, Lock, ChevronRight, X, ShieldCheck, Sparkles } from 'lucide-react-native';

const topics = [
  {
    id: 'cprBasics',
    title: 'CPR Basics',
    subtitle: 'Learn how to perform CPR correctly for adults and children.',
    icon: Heart,
    accent: '#FCE7F3',
    color: '#BE185D',
    sections: [
      {
        heading: 'What is CPR?',
        points: [
          'Lifesaving technique to keep oxygen moving when the heart stops.',
          'It combines chest compressions and rescue breaths to support circulation.',
        ],
      },
      {
        heading: 'When to perform CPR',
        points: [
          'If someone is unresponsive and not breathing normally.',
          'Call emergency services immediately before or while you begin.',
        ],
      },
      {
        heading: 'Adult CPR steps',
        points: [
          'Call for help, then begin 30 chest compressions.',
          'Push hard and fast at 100–120 compressions per minute.',
          'Give 2 rescue breaths if you are trained.',
        ],
      },
      {
        heading: 'Child CPR differences',
        points: [
          'Use one hand for compressions on most children.',
          'Compress about one-third of the chest depth.',
          'If alone, do 5 cycles before calling for help when safe to do so.',
        ],
      },
      {
        heading: 'Rescue breathing',
        points: [
          'Tilt the head back and lift the chin gently.',
          'Give breaths until the chest rises visibly.',
          'If you can’t breathe for them, continue compressions only.',
        ],
      },
      {
        heading: 'Compression ratio',
        points: [
          'Use 30 compressions followed by 2 breaths when trained.',
          'Hands-only CPR is better than no CPR at all.',
        ],
      },
      {
        heading: 'Common mistakes',
        points: [
          'Avoid stopping compressions too often.',
          'Press deep enough and keep a steady rhythm.',
          'Do not lean on the chest between compressions.',
        ],
      },
    ],
    notes: [
      { type: 'tip', text: 'Keep your arms straight and use your body weight for strong compressions.' },
      { type: 'warning', text: 'Do not pause too long once compressions have started.' },
    ],
  },
  {
    id: 'firstAid',
    title: 'First Aid',
    subtitle: 'Treat common injuries until professional help arrives.',
    icon: Bandage,
    accent: '#FEE2E2',
    color: '#C0262E',
    sections: [
      {
        heading: 'Cuts',
        points: [
          'Clean the wound with water and cover it with a sterile dressing.',
          'Apply steady pressure to stop bleeding.',
          'Call for help if bleeding is heavy or won’t stop.',
        ],
      },
      {
        heading: 'Burns',
        points: [
          'Cool the burn with running water for 10 minutes.',
          'Cover loosely with a clean cloth.',
          'Seek care for deep or large burns.',
        ],
      },
      {
        heading: 'Nosebleeds',
        points: [
          'Sit upright and lean forward slightly.',
          'Pinch the soft part of the nose for 10–15 minutes.',
          'Call for help if it keeps bleeding or follows an injury.',
        ],
      },
      {
        heading: 'Choking',
        points: [
          'Encourage coughing if the person can breathe.',
          'Use back blows and abdominal thrusts if the airway is blocked.',
          'Call emergency services if breathing stops.',
        ],
      },
      {
        heading: 'Fractures',
        points: [
          'Keep the injured limb still and supported.',
          'Do not move the person unless they are in danger.',
          'Seek medical help for severe pain or deformity.',
        ],
      },
      {
        heading: 'Sprains',
        points: [
          'Rest, ice, compression, and elevation can help.',
          'Avoid putting weight on the injured area.',
          'Get help if swelling or pain is severe.',
        ],
      },
      {
        heading: 'Heat stroke',
        points: [
          'Move to a cool place and loosen clothing.',
          'Offer water if they are able to drink.',
          'Call for help if symptoms worsen quickly.',
        ],
      },
      {
        heading: 'Fainting',
        points: [
          'Lay the person flat and raise their legs slightly.',
          'Keep the area calm and comfortable.',
          'Seek help if they do not recover quickly.',
        ],
      },
    ],
    notes: [
      { type: 'info', text: 'A calm response can stabilize someone until professionals arrive.' },
    ],
  },
  {
    id: 'emergencyResponse',
    title: 'Emergency Response',
    subtitle: 'Learn what to do during different emergency situations.',
    icon: AlertTriangle,
    accent: '#FEF3C7',
    color: '#B45309',
    sections: [
      {
        heading: 'Road accidents',
        items: [
          { label: 'What to do', points: ['Stop safely, turn on hazard lights, and move to a secure position if possible.', 'Check for injuries and call emergency services immediately.'] },
          { label: 'What NOT to do', points: ['Do not move seriously injured people unless there is immediate danger.', 'Do not leave the scene before help arrives.'] },
          { label: 'When to call', points: ['Call if anyone is hurt, unresponsive, or bleeding heavily.'] },
        ],
      },
      {
        heading: 'Fire',
        items: [
          { label: 'What to do', points: ['Leave the area calmly and use the nearest safe exit.', 'Call emergency services from a safe location.'] },
          { label: 'What NOT to do', points: ['Do not use elevators or return for belongings.', 'Do not open doors that feel hot.'] },
          { label: 'When to call', points: ['Call as soon as you are safe and able to speak clearly.'] },
        ],
      },
      {
        heading: 'Flood',
        items: [
          { label: 'What to do', points: ['Move to higher ground and avoid flooded areas.', 'Keep updated on local alerts.'] },
          { label: 'What NOT to do', points: ['Do not walk or drive through moving water.', 'Do not touch electrical equipment while wet.'] },
          { label: 'When to call', points: ['Call if water enters your space or people are trapped.'] },
        ],
      },
      {
        heading: 'Earthquake',
        items: [
          { label: 'What to do', points: ['Drop, cover, and hold on under sturdy furniture.', 'Stay indoors until shaking stops, then move outside.'] },
          { label: 'What NOT to do', points: ['Do not run outside during the quake.', 'Do not stand near windows or heavy shelves.'] },
          { label: 'When to call', points: ['Call after the shaking stops if someone is injured or buildings are damaged.'] },
        ],
      },
      {
        heading: 'Electric shock',
        items: [
          { label: 'What to do', points: ['Turn off power if it is safe, and call emergency services.', 'Do not touch the person while they are still in contact with electricity.'] },
          { label: 'What NOT to do', points: ['Do not move the victim until power is off.', 'Do not use bare hands to separate them from the source.'] },
          { label: 'When to call', points: ['Call immediately for any severe shock or loss of consciousness.'] },
        ],
      },
      {
        heading: 'Gas leak',
        items: [
          { label: 'What to do', points: ['Leave the area quickly and avoid using electrical switches.', 'Call emergency services from a safe distance.'] },
          { label: 'What NOT to do', points: ['Do not light matches or use devices that can spark.', 'Do not stay in enclosed spaces.'] },
          { label: 'When to call', points: ['Call right away if you smell gas or feel unwell.'] },
        ],
      },
    ],
    notes: [
      { type: 'warning', text: 'Always keep yourself safe first before assisting others.' },
    ],
  },
  {
    id: 'womensSafety',
    title: "Women's Safety",
    subtitle: 'Practical personal safety tips for everyday situations.',
    icon: User,
    accent: '#FCE7FF',
    color: '#9333EA',
    sections: [
      {
        heading: 'Ride sharing safety',
        points: [
          'Confirm the vehicle and driver details before getting in.',
          'Share your trip details with someone you trust.',
        ],
      },
      {
        heading: 'Walking alone',
        points: [
          'Choose well-lit, populated routes.',
          'Stay aware of your surroundings and trust your instincts.',
        ],
      },
      {
        heading: 'Public transport',
        points: [
          'Sit near the driver or other passengers when possible.',
          'Keep your belongings close and stay alert boarding and exiting.',
        ],
      },
      {
        heading: 'Emergency SOS usage',
        points: [
          'Know how to activate your phone’s emergency tools.',
          'Save trusted contacts for quick access.',
        ],
      },
      {
        heading: 'Situational awareness',
        points: [
          'Notice exits, security personnel, and safe spaces in new places.',
          'Avoid distractions while moving through busy areas.',
        ],
      },
      {
        heading: 'Safe meeting practices',
        points: [
          'Meet in public, familiar locations.',
          'Tell a friend where you are going and when you will return.',
        ],
      },
    ],
    notes: [
      { type: 'info', text: 'Simple habits can help you feel more confident and secure.' },
    ],
  },
  {
    id: 'cyberSafety',
    title: 'Cyber Safety',
    subtitle: 'Protect yourself from scams, fraud and online threats.',
    icon: Lock,
    accent: '#E0E7FF',
    color: '#2563EB',
    sections: [
      {
        heading: 'OTP scams',
        points: [
          'Never share one-time passwords with anyone.',
          'Treat unexpected OTP requests as a warning sign.',
        ],
      },
      {
        heading: 'Phishing',
        points: [
          'Verify senders before clicking links.',
          'Watch for spelling errors and unusual requests.',
        ],
      },
      {
        heading: 'Fake QR codes',
        points: [
          'Use trusted sources and inspect the code before scanning.',
          'Avoid codes from unsolicited messages.',
        ],
      },
      {
        heading: 'Fake customer care',
        points: [
          'Use official channels to verify support requests.',
          'Never share passwords or verification codes over the phone.',
        ],
      },
      {
        heading: 'Public Wi-Fi risks',
        points: [
          'Avoid sensitive accounts on insecure networks.',
          'Use a personal hotspot for private tasks when possible.',
        ],
      },
      {
        heading: 'Password hygiene',
        points: [
          'Use strong, unique passwords for each account.',
          'Enable two-factor authentication whenever available.',
        ],
      },
    ],
    notes: [
      { type: 'tip', text: 'Small online habits protect your personal data and peace of mind.' },
    ],
  },
];

const renderPoints = (points) =>
  points.map((point, index) => (
    <View key={index} className="flex-row items-start gap-3 mb-2">
      <View className="mt-1 h-2 w-2 rounded-full bg-[#D81B60]" />
      <Text className="text-[#4A2E35] text-sm leading-6">{point}</Text>
    </View>
  ));

const InfoBox = ({ text, isWarning }) => (
  <View className={`rounded-3xl p-4 mb-4 ${isWarning ? 'bg-[#FEE2E2] border border-[#FCA5A5]' : 'bg-[#E0F2FE] border border-[#BFDBFE]'}`}>
    <Text className={`text-sm font-semibold mb-2 ${isWarning ? 'text-[#991B1B]' : 'text-[#1D4ED8]'}`}>{isWarning ? 'Warning' : 'Helpful tip'}</Text>
    <Text className="text-[#4A2E35] text-sm leading-6">{text}</Text>
  </View>
);

export default function SafetyScreen() {
  const [selectedTopic, setSelectedTopic] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (selectedTopic) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(translateAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      translateAnim.setValue(30);
    }
  }, [selectedTopic, fadeAnim, translateAnim]);

  const topic = topics.find((item) => item.id === selectedTopic);

  return (
    <SafeAreaView className="flex-1 bg-[#FDF8F9]">
      <ScrollView className="flex-1 px-6 pt-8" showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <Text className="text-3xl font-black text-[#4A2E35]">Learn</Text>
          <Text className="text-[#4A2E35] text-base font-semibold mt-3">Knowledge that could save a life.</Text>
          <Text className="text-[#9E7A80] text-sm leading-6 mt-2">Tap any topic to learn essential emergency response techniques.</Text>
        </View>

        <View className="space-y-4">
          {topics.map((item) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.86}
                onPress={() => setSelectedTopic(item.id)}
                className="bg-white rounded-[32px] p-5 shadow-sm border border-[#E5B2B9]/50"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="rounded-3xl p-3" style={{ backgroundColor: item.accent }}>
                      <Icon size={22} color={item.color} />
                    </View>
                    <View className="ml-4 max-w-[72%]">
                      <Text className="text-[#4A2E35] font-bold text-lg">{item.title}</Text>
                      <Text className="text-[#6B7280] text-sm leading-5 mt-1">{item.subtitle}</Text>
                    </View>
                  </View>
                  <ChevronRight size={24} color="#D81B60" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="mt-10 mb-20 px-2">
          <Text className="text-[#9E7A80] text-xs uppercase tracking-[1px] mb-2">Note</Text>
          <Text className="text-[#6B7280] text-sm leading-6">These guides are meant for basic emergency awareness. Always contact local emergency services during serious situations.</Text>
        </View>
      </ScrollView>

      <Modal transparent visible={!!topic} animationType="fade" onRequestClose={() => setSelectedTopic(null)}>
        <View className="flex-1 bg-black/30 justify-end">
          <Pressable className="flex-1" onPress={() => setSelectedTopic(null)} />
          <Animated.View
            className="bg-white rounded-t-[32px] p-6 max-h-[88%]"
            style={{ opacity: fadeAnim, transform: [{ translateY: translateAnim }] }}
          >
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-1 pr-3">
                <Text className="text-3xl font-black text-[#111827]">{topic?.title}</Text>
                <Text className="text-[#6B7280] text-sm leading-6 mt-2">{topic?.subtitle}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedTopic(null)} className="p-2 bg-[#F5F3FF] rounded-full">
                <X size={20} color="#7C3AED" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
              <View className="rounded-[28px] bg-[#FAF5FF] border border-[#E9D5FF] p-5 mb-5">
                <View className="flex-row items-center justify-between mb-4">
                  <View>
                    <Text className="text-[#7C3AED] text-xs uppercase tracking-[1px] font-semibold">Topic guide</Text>
                    <Text className="text-[#111827] text-xl font-bold mt-2">{topic?.title}</Text>
                  </View>
                  <View className="rounded-3xl p-4 bg-white shadow-sm">
                    <ShieldCheck size={28} color={topic?.color || '#4338CA'} />
                  </View>
                </View>
                <Text className="text-[#4B5563] text-sm leading-6">These practical steps are designed for awareness and calm action.</Text>
              </View>

              {topic?.sections.map((section, sectionIndex) => (
                <View key={sectionIndex} className="mb-5">
                  <Text className="text-[#111827] font-semibold text-base mb-3">{section.heading}</Text>
                  {section.points ? renderPoints(section.points) : null}
                  {section.items
                    ? section.items.map((item, itemIndex) => (
                        <View key={itemIndex} className="mb-4">
                          <Text className="text-[#4A2E35] font-semibold text-sm mb-2">{item.label}</Text>
                          {renderPoints(item.points)}
                        </View>
                      ))
                    : null}
                </View>
              ))}

              {topic?.notes?.map((note, noteIndex) => (
                <InfoBox key={noteIndex} text={note.text} isWarning={note.type === 'warning'} />
              ))}

              <View className="rounded-[28px] bg-[#FDF2F8] border border-[#FBCFE8] p-5 mt-2">
                <View className="flex-row items-center mb-3">
                  <Sparkles size={20} color="#C026D3" />
                  <Text className="text-[#C026D3] font-bold text-sm ml-2">🩷 Remember</Text>
                </View>
                <Text className="text-[#4A2E35] text-sm leading-6">Knowledge saves lives.</Text>
                <Text className="text-[#4A2E35] text-sm leading-6 mt-1">Stay calm. Stay aware. Stay safe.</Text>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
