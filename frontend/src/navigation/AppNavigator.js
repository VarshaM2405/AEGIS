import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import SOSScreen from '../screens/SOSScreen';
import RoutePlanningScreen from '../screens/RoutePlanningScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Onboarding">
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="RoutePlanning" component={RoutePlanningScreen} />
      {/* We can present SOSScreen as a modal or push over the stack */}
      <Stack.Screen name="SOSModal" component={SOSScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
