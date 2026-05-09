import React, { createContext, useState, useEffect } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isContextLoaded, setIsContextLoaded] = useState(false);

  const toggleSOS = () => setIsSOSActive(!isSOSActive);
  
  const handleSetUser = async (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    await AsyncStorage.setItem('@aegis_user', JSON.stringify(userData));
  };

  const logout = async () => { 
    setUser(null); 
    setIsLoggedIn(false); 
    await AsyncStorage.removeItem('@aegis_user');
  };

  useEffect(() => {
    const loadState = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('@aegis_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setIsLoggedIn(true);
        }
      } catch (e) {
        console.error("Failed to load user state", e);
      } finally {
        setIsContextLoaded(true);
      }
    };
    loadState();
  }, []);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      
      const locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 2,
        },
        (newLocation) => {
          setLocation(newLocation);
        }
      );

      const headingSubscription = await Location.watchHeadingAsync((newHeading) => {
        setLocation((prev) => prev ? { ...prev, coords: { ...prev.coords, heading: newHeading.trueHeading } } : prev);
      });
      
      return () => {
        locationSubscription.remove();
        headingSubscription.remove();
      };
    })();
  }, []);

  return (
    <GlobalContext.Provider value={{ 
      isSOSActive, toggleSOS, location, errorMsg, 
      user, setUser: handleSetUser, isLoggedIn, setIsLoggedIn, logout, isContextLoaded
    }}>
      {children}
    </GlobalContext.Provider>
  );
};
