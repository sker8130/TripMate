import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { Tabs } from "expo-router";
import React, { useEffect, useRef, useState } from "react";

import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "../../context/AppContext";

const COLORS = {
  orange: "#F56A16",
  white: "#FFFFFF",

  text: "#111315",
  muted: "#8A8F95",

  border: "#ECEDE8",

  danger: "#EF4444",
};

const TAB_ICONS: Record<
  string,
  {
    active: keyof typeof Ionicons.glyphMap;
    inactive: keyof typeof Ionicons.glyphMap;
  }
> = {
  trips: {
    active: "airplane",
    inactive: "airplane-outline",
  },

  notifications: {
    active: "notifications",
    inactive: "notifications-outline",
  },

  profile: {
    active: "person",
    inactive: "person-outline",
  },
};

function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

function AnimatedTabBar({ state, descriptors, navigation }: any) {
  const { unreadCount } = useApp();

  const insets = useSafeAreaInsets();

  const [width, setWidth] = useState(0);

  /*
   * 0 = Trips
   * 1 = Notifications
   * 2 = Profile
   */
  const activeIndex = useRef(new Animated.Value(state.index)).current;

  const soundRef = useRef<Audio.Sound | null>(null);

  /*
   * Load âm thanh 1 lần.
   */
  useEffect(() => {
    let mounted = true;

    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/sounds/tab-click.wav"),
          {
            volume: 0.12,
          },
        );

        if (mounted) {
          soundRef.current = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch {
        /*
         * Audio lỗi thì navigation
         * vẫn hoạt động bình thường.
         */
      }
    };

    loadSound();

    return () => {
      mounted = false;

      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  /*
   * Animation đơn giản:
   * không spring / không bounce.
   */
  useEffect(() => {
    Animated.timing(activeIndex, {
      toValue: state.index,

      duration: 180,

      easing: Easing.out(Easing.cubic),

      useNativeDriver: true,
    }).start();
  }, [state.index, activeIndex]);

  const playTabSound = async () => {
    const sound = soundRef.current;

    if (!sound) {
      return;
    }

    try {
      await sound.setPositionAsync(0);

      await sound.playAsync();
    } catch {
      // không block navigation
    }
  };

  const tabCount = state.routes.length;

  const tabWidth = width > 0 ? width / tabCount : 0;

  /*
   * Kích thước nền cam
   * phía sau icon.
   */
  const indicatorWidth = 40;

  const translateX = Animated.add(
    Animated.multiply(activeIndex, tabWidth),

    tabWidth > 0 ? (tabWidth - indicatorWidth) / 2 : 0,
  );

  return (
    <View
      style={[
        styles.tabBarOuter,
        {
          paddingBottom: Math.max(insets.bottom, 7),
        },
      ]}
    >
      <View
        style={styles.tabBar}
        onLayout={(event) => {
          setWidth(event.nativeEvent.layout.width);
        }}
      >
        {/*
         * Chỉ có một indicator cam.
         * Nó chạy từ tab này sang tab khác.
         */}
        {width > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeIndicator,
              {
                width: indicatorWidth,

                transform: [
                  {
                    translateX,
                  },
                ],
              },
            ]}
          />
        )}

        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];

          const focused = state.index === index;

          const icon = TAB_ICONS[route.name];

          const onPress = async () => {
            const event = navigation.emit({
              type: "tabPress",

              target: route.key,

              canPreventDefault: true,
            });

            /*
             * Không phát sound nếu
             * đang đứng đúng tab đó.
             */
            if (!focused && !event.defaultPrevented) {
              playTabSound();

              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              style={styles.tabItem}
              onPress={onPress}
              onLongPress={() => {
                navigation.emit({
                  type: "tabLongPress",

                  target: route.key,
                });
              }}
            >
              <View style={styles.iconArea}>
                <View>
                  <Ionicons
                    name={focused ? icon.active : icon.inactive}
                    size={21}
                    color={focused ? COLORS.white : COLORS.muted}
                  />

                  {route.name === "notifications" && (
                    <NotificationBadge count={unreadCount} />
                  )}
                </View>
              </View>

              <Text style={[styles.label, focused && styles.labelActive]}>
                {options.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="trips"
        options={{
          title: "Chuyến đi",
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: "Thông báo",
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Cá nhân",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    backgroundColor: COLORS.white,

    borderTopWidth: 1,

    borderTopColor: COLORS.border,

    paddingHorizontal: 10,

    paddingTop: 6,
  },

  tabBar: {
    position: "relative",

    flexDirection: "row",

    height: 57,
  },

  /*
   * Không spring.
   * Chỉ là ô cam chạy ngang.
   */
  activeIndicator: {
    position: "absolute",

    top: 0,
    left: 0,

    height: 36,

    borderRadius: 12,

    backgroundColor: COLORS.orange,
  },

  tabItem: {
    flex: 1,

    height: 57,

    alignItems: "center",

    justifyContent: "flex-start",
  },

  iconArea: {
    width: 40,

    height: 36,

    alignItems: "center",

    justifyContent: "center",
  },

  label: {
    marginTop: 4,

    fontSize: 10,

    color: COLORS.muted,

    fontWeight: "600",
  },

  labelActive: {
    color: COLORS.text,

    fontWeight: "700",
  },

  badge: {
    position: "absolute",

    top: -8,
    right: -11,

    minWidth: 17,

    height: 17,

    borderRadius: 9,

    paddingHorizontal: 3,

    backgroundColor: COLORS.danger,

    borderWidth: 2,

    borderColor: COLORS.white,

    alignItems: "center",

    justifyContent: "center",
  },

  badgeText: {
    color: COLORS.white,

    fontSize: 8,

    fontWeight: "900",
  },
});
