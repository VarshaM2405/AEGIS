import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, MapPin, Users, ArrowRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { styled } from 'nativewind';

const { width } = Dimensions.get('window');

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

const ONBOARDING_DATA = [
  {
    title: "Stay Safe, Always",
    description: "Navigate with confidence using AI-powered safety predictions and real-time crime data.",
    icon: Shield,
    color: ['#E5B2B9', '#D81B60'],
  },
  {
    title: "Smart Route Planning",
    description: "Get the safest routes, not just the fastest. Your wellbeing is our priority.",
    icon: MapPin,
    color: ['#E0B0FF', '#C71585'],
  },
  {
    title: "Community Support",
    description: "Connected to a network of helpers ready to assist in emergencies. You're never alone.",
    icon: Users,
    color: ['#DDA7A5', '#9E7A80'],
  }
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigation = useNavigation();

  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      navigation.navigate('Login');
    }
  };

  const handleSkip = () => {
    navigation.navigate('Login');
  };

  const currentStep = ONBOARDING_DATA[currentIndex];
  const IconComponent = currentStep.icon;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F9' }}>
      <View className="flex-1 items-center justify-between py-10 px-6">
        
        {/* Header Section */}
        <View className="items-center">
          <StyledText className="text-3xl font-extrabold text-[#D81B60] tracking-widest">AEGIS</StyledText>
          <StyledText className="text-sm text-gray-500 font-medium mt-1">Adaptive Safety Navigation</StyledText>
        </View>

        {/* Visual Section */}
        <View className="items-center">
          <LinearGradient
            colors={currentStep.color}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="w-40 h-40 rounded-[40px] items-center justify-center shadow-lg"
            style={{ elevation: 15, shadowColor: currentStep.color[0], shadowOpacity: 0.3, shadowRadius: 20 }}
          >
            <IconComponent size={80} color="white" strokeWidth={1.5} />
          </LinearGradient>
        </View>

        {/* Text Content */}
        <View className="items-center">
          <StyledText className="text-3xl font-bold text-[#4A2E35] text-center mb-4">
            {currentStep.title}
          </StyledText>
          <StyledText className="text-base text-gray-400 text-center leading-6 px-4">
            {currentStep.description}
          </StyledText>
        </View>

        {/* Footer Section */}
        <View className="w-full items-center">
          {/* Pagination Dots */}
          <View className="flex-row space-x-2 mb-8">
            {ONBOARDING_DATA.map((_, i) => (
              <View 
                key={i} 
                className={`h-2 rounded-full ${i === currentIndex ? 'w-10 bg-[#D81B60]' : 'w-2 bg-[#DDA7A5]'}`} 
              />
            ))}
          </View>

          {/* CTA Button */}
          <StyledTouchableOpacity 
            onPress={handleNext} 
            className="w-full h-16 rounded-full overflow-hidden mb-4"
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#E5B2B9', '#D81B60']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="w-full h-full flex-row items-center justify-center"
            >
              <StyledText className="text-white text-lg font-bold mr-2">
                {currentIndex === ONBOARDING_DATA.length - 1 ? "Get Started" : "Continue"}
              </StyledText>
              <ArrowRight color="white" size={20} />
            </LinearGradient>
          </StyledTouchableOpacity>

          {/* Skip Button */}
          <StyledTouchableOpacity onPress={handleSkip} activeOpacity={0.6}>
            <StyledText className="text-gray-400 font-medium text-base">Skip</StyledText>
          </StyledTouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}
