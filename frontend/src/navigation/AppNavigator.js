import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import SOSScreen from '../screens/SOSScreen';
import RoutePlanningScreen from '../screens/RoutePlanningScreen';
import WearableScreen from '../screens/WearableScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Map, ShieldAlert, Watch, User } from 'lucide-react-native';
import { View, Text } from 'react-native';
import SplashScreen from '../screens/SplashScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator 
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#D81B60',
        tabBarInactiveTintColor: '#DDA7A5',
        tabBarLabelStyle: { fontFamily: 'Outfit_700Bold', fontSize: 11, marginTop: 2 },
        tabBarStyle: { height: 90, paddingBottom: 30, paddingTop: 10, borderTopWidth: 0, elevation: 20, shadowColor: '#DDA7A5', shadowOpacity: 0.15, shadowRadius: 10 },
        tabBarIcon: ({ color, size }) => {
          let IconComp;
          if (route.name === 'HomeTab') IconComp = Home;
          else if (route.name === 'RouteTab') IconComp = Map;
          else if (route.name === 'SOSTab') IconComp = ShieldAlert;
          else if (route.name === 'WearableTab') IconComp = Watch;
          else if (route.name === 'ProfileTab') IconComp = User;
          return <IconComp size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="RouteTab" component={RoutePlanningScreen} options={{ tabBarLabel: 'Route' }} />
      <Tab.Screen name="SOSTab" component={SOSScreen} options={{ tabBarLabel: 'SOS' }} />
      <Tab.Screen name="WearableTab" component={WearableScreen} options={{ tabBarLabel: 'Sync' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
      {/* Keeping Planning and SOS accessible directly if needed */}
      <Stack.Screen name="RoutePlanning" component={RoutePlanningScreen} />
      <Stack.Screen name="SOSModal" component={SOSScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
