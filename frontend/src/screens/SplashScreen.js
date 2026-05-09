import React, { useEffect, useRef, useContext } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GlobalContext } from '../contexts/GlobalContext';
import Svg, { Polygon } from 'react-native-svg';

export default function SplashScreen() {
  const navigation = useNavigation();
  const { isLoggedIn, isContextLoaded } = useContext(GlobalContext);

  const rotateAnim1 = useRef(new Animated.Value(0)).current;
  const rotateAnim2 = useRef(new Animated.Value(0)).current;
  const fadeA = useRef(new Animated.Value(0)).current;
  const scaleA = useRef(new Animated.Value(0.5)).current;
  const fadeLetters = useRef([
    new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)
  ]).current;

  useEffect(() => {
    // Rotation animations for geometric frames
    Animated.loop(
      Animated.timing(rotateAnim1, {
        toValue: 1,
        duration: 15000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim2, {
        toValue: 1,
        duration: 15000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Sequence for typography and centerpiece
    Animated.sequence([
      Animated.timing(fadeA, { toValue: 1, duration: 1500, useNativeDriver: true, delay: 500 }),
      Animated.stagger(300, fadeLetters.map(anim => Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true })))
    ]).start();

    Animated.timing(scaleA, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true, delay: 500 }).start();

  }, []);

  useEffect(() => {
    if (isContextLoaded) {
      // Increased to 6 seconds so the splash screen is on longer
      const timer = setTimeout(() => {
        navigation.replace(isLoggedIn ? 'Main' : 'Onboarding');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [isContextLoaded, isLoggedIn, navigation]);

  const spin1 = rotateAnim1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = rotateAnim2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const letters = [
    { char: 'A', color: '#E5B2B9' },
    { char: 'E', color: '#E5B2B9' },
    { char: 'G', color: '#E5B2B9' },
    { char: 'I', color: '#E5B2B9' },
    { char: 'S', color: '#E5B2B9' }
  ];

  // 140x140 Octagon coordinates
  const octagonPoints = "41,0 99,0 140,41 140,99 99,140 41,140 0,99 0,41";

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.View style={[styles.shapeLayer, { transform: [{ rotate: spin1 }] }]}>
           <Svg height="140" width="140" viewBox="0 0 140 140">
              <Polygon points={octagonPoints} fill="none" stroke="#E5B2B9" strokeWidth="1.5" />
           </Svg>
        </Animated.View>
        <Animated.View style={[styles.shapeLayer, { transform: [{ rotate: spin2 }] }]}>
           <Svg height="140" width="140" viewBox="0 0 140 140">
              <Polygon points={octagonPoints} fill="none" stroke="#D81B60" strokeWidth="1.5" />
           </Svg>
        </Animated.View>
        
        <Animated.View style={[styles.aContainer, { opacity: fadeA, transform: [{ scale: scaleA }] }]}>
          <Text style={styles.fancyA}>A</Text>
        </Animated.View>
      </View>

      <View style={styles.textContainer}>
        {letters.map((item, index) => (
          <Animated.Text 
            key={index} 
            style={[
              styles.letter, 
              { 
                color: item.color,
                opacity: fadeLetters[index], 
                transform: [{ 
                  translateY: fadeLetters[index].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) 
                }] 
              }
            ]}
          >
            {item.char}
          </Animated.Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F9', alignItems: 'center', justifyContent: 'center' },
  center: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  shapeLayer: { position: 'absolute', width: 140, height: 140 },
  aContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  fancyA: { fontSize: 60, fontFamily: 'Cinzel_400Regular', color: '#D81B60', includeFontPadding: false },
  textContainer: { position: 'absolute', bottom: 100, flexDirection: 'row', width: 200, justifyContent: 'space-between' },
  letter: { fontSize: 28, fontFamily: 'Cinzel_400Regular' }
});
