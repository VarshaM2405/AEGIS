import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import SOSScreen from '../screens/SOSScreen';
import RoutePlanningScreen from '../screens/RoutePlanningScreen';
import SafetyScreen from '../screens/SafetyScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ReportScreen from '../screens/ReportScreen';
import ZonesScreen from '../screens/ZonesScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Map, ShieldAlert, Shield, User } from 'lucide-react-native';
import { View, Text } from 'react-native';
import SplashScreen from '../screens/SplashScreen';
import { TouchableOpacity } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const EmptyScreen = () => null;

function MainTabs() {
  return (
    <View style={{ flex: 1 }}>
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
            else if (route.name === 'SafetyTab') IconComp = Shield;
            else if (route.name === 'ProfileTab') IconComp = User;
            return <IconComp size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
        <Tab.Screen name="RouteTab" component={RoutePlanningScreen} options={{ tabBarLabel: 'Route' }} />
        <Tab.Screen
          name="SOSTab"
          component={EmptyScreen}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              // open the modal on the parent stack to match Home's SOS button
              navigation.getParent()?.navigate('SOSModal');
            },
          })}
          options={{
            tabBarLabel: 'SOS',
            tabBarLabelStyle: { fontSize: 13, fontWeight: '800', color: '#8c1a2b' },
            tabBarButton: (props) => {
              const focused = props.accessibilityState?.selected;
              return (
                <TouchableOpacity
                  {...props}
                  activeOpacity={0.85}
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    top: 6,
                    flex: 1,
                  }}
                >
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: '#ff3b30',
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 12,
                    borderWidth: 2,
                    borderColor: '#fff'
                  }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>SOS</Text>
                  </View>
                </TouchableOpacity>
              );
            }
          }}
        />
        <Tab.Screen name="SafetyTab" component={SafetyScreen} options={{ tabBarLabel: 'Safety' }} />
        <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
      </Tab.Navigator>
    </View>
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
      <Stack.Screen name="Report" component={ReportScreen} />
      <Stack.Screen name="Zones" component={ZonesScreen} />
    </Stack.Navigator>
  );
}
