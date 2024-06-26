import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, Modal, Button} from 'react-native';
import MapView, {Marker, Circle} from 'react-native-maps';
import * as Notifications from 'expo-notifications';
import {initializeApp} from 'firebase/app';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import {firebaseConfig} from './frontend/config';
import {
  schedulePushNotification,
  registerForPushNotificationsAsync,
} from './frontend/notifications';
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  geofence,
} from './frontend/locationservice';

initializeApp(firebaseConfig);

// Main App component
const App = () => {
  // State variables declaration using hooks
  const [spots, setSpots] = useState(0);
  const [handicapSpots, setHandicapSpots] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isInside, setIsInside] = useState(false);

  // Effect hook to register push notification token on initial load
  useEffect(() => {
    const registerToken = async () => {
      const expoPushToken = await registerForPushNotificationsAsync();

      // Registering token with server
      fetch(`${process.env.REACT_SERVER_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: expoPushToken,
        }),
      });
    };

    registerToken();
  }, []);

  // Effect hook to fetch parking spots and start location tracking on first visit
  useEffect(() => {
    const onFirstVisit = async () => {
      console.log('Trigger push notification');
      await fetchSpots();
    };

    // Starting background location tracking
    startBackgroundLocationTracking(onFirstVisit, setIsInside, setUserLocation);

    // Cleanup function to stop background location tracking
    return () => {
      stopBackgroundLocationTracking();
    };
  }, []);

  // Function to fetch parking spots data
  const fetchSpots = async () => {
    let spots = 0;
    let handicapSpots = 0;

    // Fetching regular parking spots data
    await fetch(`${process.env.REACT_PARKINGSPOTS_URL}`)
      .then((response) => response.text())
      .then((text) => {
        return JSON.parse(text);
      })
      .then((data) => {
        console.log('Data fetched successfully', data);
        spots = data.free_spots;
      })
      .catch((error) => {
        console.error('Error fetching data', error);
      });

    // Fetching handicap parking spots data
    await fetch(`${process.env.REACT_HANDICAP_PARKINGSPOTS_URL}`)
      .then((response) => response.text())
      .then((text) => {
        return JSON.parse(text);
      })
      .then((data) => {
        console.log('Data fetched successfully', data);
        handicapSpots = data.free_handicap_spots;
      })
      .catch((error) => {
        console.error('Error fetching data', error);
      });

    // Updating state variables
    setSpots(spots);
    setHandicapSpots(handicapSpots);

    // Scheduling push notification if user is inside geofence
    if (isInside) {
      await schedulePushNotification(spots, handicapSpots);
    }
  };

  // Effect hook to fetch parking spots data periodically and register background fetch task
  useEffect(() => {
    fetchSpots();

    // Registering background fetch task
    BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 1,
    });
    console.log('Background fetch task registered');

    // Setting up periodic fetching of parking spots data
    const intervalId = setInterval(fetchSpots, 10000);

    // Cleanup function to clear interval
    return () => clearInterval(intervalId);
  }, []);

  // Effect hook to start location tracking and fetch spots on location change
  useEffect(() => {
    const onFirstVisit = () => {
      fetchSpots();
    };

    const onLocationChange = (isInsideGeofence) => {
      setIsInside(isInsideGeofence);
    };

    startBackgroundLocationTracking(
      onFirstVisit,
      onLocationChange,
      setUserLocation,
    );

    // Cleanup function to stop background location tracking
    return () => {
      stopBackgroundLocationTracking();
    };
  }, []);

  // Effect hook to handle received notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      () => {},
    );
    return () => subscription.remove();
  }, []);

  const BACKGROUND_FETCH_TASK = 'background-fetch';

  // Defining background fetch task
  TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
    const now = Date.now();
    console.log(
      `Got background fetch call at date: ${new Date(now).toISOString()}`,
    );
    try {
      await fetchSpots();

      console.log('Background fetch task completed successfully');
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (err) {
      console.error('Background fetch task failed:', err);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });

  // Rendering the UI components
  return (
    <View style={styles.container}>
      <View style={{margin: 40, width: 100, alignSelf: 'center'}}>
        <Button
          title={modalVisible ? 'Hide Map' : 'Show Map'}
          onPress={() => setModalVisible(!modalVisible)}
        />
      </View>
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <View style={{marginTop: 22}}>
          <View style={{margin: 40, width: 100, alignSelf: 'center'}}>
            <Button
              title={modalVisible ? 'Hide Map' : 'Show Map'}
              onPress={() => setModalVisible(!modalVisible)}
            />
          </View>
          <View>
            {geofence && (
              <View
                style={{
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginTop: 20,
                }}
              >
                <MapView
                  style={{width: 450, height: 450}}
                  initialRegion={{
                    latitude: userLocation
                      ? userLocation.latitude
                      : geofence.latitude,
                    longitude: userLocation
                      ? userLocation.longitude
                      : geofence.longitude,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                  }}
                  region={{
                    latitude: userLocation
                      ? userLocation.latitude
                      : geofence.latitude,
                    longitude: userLocation
                      ? userLocation.longitude
                      : geofence.longitude,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: userLocation
                        ? userLocation.latitude
                        : geofence.latitude,
                      longitude: userLocation
                        ? userLocation.longitude
                        : geofence.longitude,
                    }}
                    title="My Location"
                  >
                    <View style={{padding: 10}}>
                      <Text style={{fontSize: 40}}>📍</Text>
                    </View>
                  </Marker>
                  <Marker
                    coordinate={{
                      latitude: geofence.latitude,
                      longitude: geofence.longitude,
                    }}
                    title="Target Location"
                  >
                    <View style={{padding: 10}}>
                      <Text style={{fontSize: 40}}>📍</Text>
                    </View>
                  </Marker>
                  <Circle
                    center={geofence}
                    radius={geofence.radius}
                    strokeColor="rgba(255,0,0,1)"
                    fillColor="rgba(255,0,0,0.3)"
                  />
                </MapView>
              </View>
            )}
          </View>
        </View>
      </Modal>
      <View style={styles.overlay}>
        <Text style={styles.title}>
          Parking Spot Availability at Karaportti 2:
        </Text>
        <Text style={styles.spots}>{spots}</Text>
        <Text style={styles.subtitle}>Available Spots</Text>
        <Text style={styles.spots}>{handicapSpots}</Text>
        <Text style={styles.subtitle}>Available Accessible Spots</Text>
      </View>
    </View>
  );
};

// Styles for the components
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FCFF',
  },
  map: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    textAlign: 'center',
    margin: 10,
  },
  spots: {
    fontSize: 80,
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 20,
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});

export default App;
