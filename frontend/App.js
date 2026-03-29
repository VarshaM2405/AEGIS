import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlobalProvider } from './src/contexts/GlobalContext';
import AppNavigator from './src/navigation/AppNavigator';
import GlobalSOSButton from './src/components/GlobalSOSButton';

export default function App() {
  return (
    <SafeAreaProvider style={styles.container}>
      <GlobalProvider>
        <NavigationContainer>
          <AppNavigator />
          <GlobalSOSButton />
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
