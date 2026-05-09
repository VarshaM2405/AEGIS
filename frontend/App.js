import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlobalProvider } from './src/contexts/GlobalContext';
import AppNavigator from './src/navigation/AppNavigator';
import { useFonts, Cinzel_400Regular, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { Outfit_400Regular, Outfit_700Bold } from '@expo-google-fonts/outfit';
// import GlobalSOSButton from './src/components/GlobalSOSButton';

export default function App() {
  const [fontsLoaded] = useFonts({
    Cinzel_400Regular,
    Cinzel_700Bold,
    Outfit_400Regular,
    Outfit_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider style={styles.container}>
      <GlobalProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </GlobalProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
