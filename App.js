import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from './context/AuthContext';
import colors from './theme/colors';

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
  Janitorial: 'sparkles',
  Guard: 'shield',
  Profile: 'person-circle',
};

const TAB_TITLES = {
  Tools: 'Tools & Equipment',
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

// A single-position account (Janitorial/Maintenance/Tools) only ever needs
// its own module — everything else on the portal is someone else's job.
// The 'tools' role is the "facilities" login in the app; 'administrator'
// is intentionally absent here so it falls through to full access below.
// Only these roles (plus administrator) can sign in at all — enforced
// server-side in Api::assertRoleAllowed().
const ROLE_TAB_MAP = {
  janitorial: 'Janitorial',
  maintenance: 'Safety',
  tools: 'Tools',
};

const tabScreenOptions = ({ route }) => ({
  headerStyle: { backgroundColor: colors.maroon },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: '700' },
  tabBarActiveTintColor: colors.maroon,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarIcon: ({ color, size }) => (
    <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
  ),
});

function MainTabs() {
  const { user } = useAuth();
  const restrictedTab = ROLE_TAB_MAP[(user?.role || '').toLowerCase().trim()];

  if (restrictedTab) {
    const Component = TAB_COMPONENTS[restrictedTab];
    return (
      <Tab.Navigator screenOptions={tabScreenOptions} initialRouteName={restrictedTab}>
        <Tab.Screen name={restrictedTab} component={Component} options={{ title: TAB_TITLES[restrictedTab] }} />
        <Tab.Screen name="Profile" component={PortalScreen} options={{ title: 'Profile' }} />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Tools" component={ToolsScreen} options={{ title: 'Tools & Equipment' }} />
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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
