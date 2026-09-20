import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';

function NotifBadge() {
  const { unreadCount } = useApp();

  if (unreadCount === 0) return null;

  return (
    <View style={badgeStyles.dot}>
      <Text style={badgeStyles.txt}>
        {unreadCount > 9 ? "9+" : unreadCount}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  dot: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: '#EF4444', borderRadius: 8,
    minWidth: 16, height: 16, paddingHorizontal: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  txt: { color: '#fff', fontSize: 9, fontWeight: '800' },
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 62,
        },
        tabBarActiveTintColor: '#1B4F8A',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: -2 },
      }}
    >
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Chuyến đi',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="airplane-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Thông báo',
          tabBarIcon: ({ color, size, focused }) => (
            <View>
              <Ionicons
                name={focused ? 'notifications' : 'notifications-outline'}
                size={size}
                color={color}
              />
              <NotifBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
