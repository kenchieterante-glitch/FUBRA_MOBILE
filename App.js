import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, View, Platform, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

import LoginScreen from './screens/LoginScreen';
import PortalScreen from './screens/PortalScreen';
import ToolsScreen from './screens/ToolsScreen';
import VehicleScreen from './screens/VehicleScreen';
import SafetyScreen from './screens/SafetyScreen';
import JanitorialScreen from './screens/JanitorialScreen';
import GuardScreen from './screens/GuardScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Tools: 'construct',
  Vehicles: 'car',
  Safety: 'shield-checkmark',
  Janitorial: 'broom',
  Guard: 'shield',
  Profile: 'person-circle',
};

const TAB_TITLES = {
  Tools: 'Tools Management',
  Vehicles: 'Vehicles',
  Safety: 'Safety',
  Janitorial: 'Janitorial',
  Guard: 'Guard Dashboard',
  Profile: 'Profile',
};

const TAB_COMPONENTS = {
  Tools: ToolsScreen,
  Vehicles: VehicleScreen,
  Safety: SafetyScreen,
  Janitorial: JanitorialScreen,
  Guard: GuardScreen,
  Profile: PortalScreen,
};

// A single-position account (Janitorial/Maintenance/Tools/Security) only
// needs its own module(s) — everything else on the portal is someone else's
// job. 'facilities' covers the broader facilities team (Tools, Vehicles,
// Safety) but deliberately excludes Janitorial, a separate role. 'administrator'
// is intentionally absent here so it falls through to full access below.
// Only these roles (plus administrator) can sign in at all — enforced
// server-side in Api::assertRoleAllowed().
const ROLE_TAB_MAP = {
  janitorial: ['Janitorial'],
  maintenance: ['Safety'],
  tools: ['Tools'],
  vehicles: ['Vehicles'],
  security: ['Guard'],
  facilities: ['Tools', 'Vehicles', 'Safety'],
};

function MainTabs() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const allowedTabs = ROLE_TAB_MAP[(user?.role || '').toLowerCase().trim()];

  const tabScreenOptions = ({ route }) => ({
    headerStyle: { backgroundColor: colors.maroon },
    headerTintColor: colors.white,
    headerTitleStyle: { fontWeight: '700' },
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
    tabBarActiveTintColor: colors.maroon,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarIcon: ({ color, size }) => (
      route.name === 'Janitorial'
        ? <MaterialCommunityIcons name={TAB_ICONS[route.name]} size={size} color={color} />
        : <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
    ),
  });

  if (allowedTabs) {
    return (
      <Tab.Navigator screenOptions={tabScreenOptions} initialRouteName={allowedTabs[0]}>
        {allowedTabs.map((tabName) => (
          <Tab.Screen
            key={tabName}
            name={tabName}
            component={TAB_COMPONENTS[tabName]}
            options={{ title: TAB_TITLES[tabName] }}
          />
        ))}
        <Tab.Screen name="Profile" component={PortalScreen} options={{ title: 'Profile' }} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Tools" component={ToolsScreen} options={{ title: 'Tools Management' }} />
      <Tab.Screen name="Vehicles" component={VehicleScreen} options={{ title: 'Vehicles' }} />
      <Tab.Screen name="Safety" component={SafetyScreen} options={{ title: 'Safety' }} />
      <Tab.Screen name="Janitorial" component={JanitorialScreen} options={{ title: 'Janitorial' }} />
      {user?.is_guard && (
        <Tab.Screen name="Guard" component={GuardScreen} options={{ title: 'Guard Dashboard' }} />
      )}
      <Tab.Screen name="Profile" component={PortalScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.maroon} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainTabs} />
      )}
    </Stack.Navigator>
  );
}

function ThemedApp() {
  const { colors, isDark } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.maroon,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

// Android has no Platform.isPad equivalent, so tablets are detected the same
// way Android itself does for resource qualifiers: shortest-side >= 600dp
// (the sw600dp breakpoint) means a 7"+ tablet, not a phone.
function isAndroidTablet() {
  if (Platform.OS !== 'android') return false;
  const { width, height } = Dimensions.get('window');
  return Math.min(width, height) >= 600;
}

export default function App() {
  useEffect(() => {
    // Tablets (iPad, Android) follow device rotation; phones stay
    // portrait-locked — none of the screens in this app were laid out with
    // landscape in mind on a phone-sized screen.
    const isTablet = (Platform.OS === 'ios' && Platform.isPad) || isAndroidTablet();
    if (isTablet) {
      ScreenOrientation.unlockAsync();
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
