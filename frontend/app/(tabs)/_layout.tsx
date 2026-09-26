import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useEffect, useRef, useState } from "react";

import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

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

/*
 * Icon tương ứng từng tab
 */
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

/*
 * Badge thông báo
 */
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

/*
 * CUSTOM BOTTOM TAB BAR
 */
function AnimatedTabBar({ state, descriptors, navigation }: any) {
  const { unreadCount } = useApp();

  const insets = useSafeAreaInsets();

  /*
   * Chiều rộng thực tế của tab bar.
   */
  const [containerWidth, setContainerWidth] = useState(0);

  /*
   * Giá trị index được animate:
   *
   * 0 = Chuyến đi
   * 1 = Thông báo
   * 2 = Cá nhân
   */
  const animatedIndex = useRef(new Animated.Value(state.index)).current;

  /*
   * Mỗi khi đổi tab,
   * indicator màu cam sẽ spring sang tab mới.
   */
  useEffect(() => {
    Animated.spring(animatedIndex, {
      toValue: state.index,

      /*
       * Tăng tension:
       * chạy nhanh hơn.
       *
       * friction:
       * kiểm soát độ nảy.
       */
      tension: 90,
      friction: 10,

      useNativeDriver: true,
    }).start();
  }, [state.index, animatedIndex]);

  const numberOfTabs = state.routes.length;

  const itemWidth = containerWidth > 0 ? containerWidth / numberOfTabs : 0;

  /*
   * Kích thước nền màu cam.
   */
  const indicatorWidth = 42;

  /*
   * Vị trí X của indicator.
   *
   * animatedIndex:
   *
   * 0 -> tab 1
   * 1 -> tab 2
   * 2 -> tab 3
   */
  const translateX = Animated.add(
    Animated.multiply(animatedIndex, itemWidth),

    itemWidth > 0 ? (itemWidth - indicatorWidth) / 2 : 0,
  );

  return (
    <View
      style={[
        styles.tabBarOuter,
        {
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <View
        style={styles.tabBar}
        onLayout={(event) => {
          setContainerWidth(event.nativeEvent.layout.width);
        }}
      >
        {/*
         * NỀN CAM TRƯỢT
         */}
        {containerWidth > 0 && (
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

          const isFocused = state.index === index;

          const icon = TAB_ICONS[route.name];

          /*
           * Animation nhẹ cho icon.
           */
          const distance = Animated.subtract(animatedIndex, index);

          const scale = distance.interpolate({
            inputRange: [-1, 0, 1],

            outputRange: [1, 1.08, 1],

            extrapolate: "clamp",
          });

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",

              target: route.key,

              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",

              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={
                isFocused
                  ? {
                      selected: true,
                    }
                  : {}
              }
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabItem}
            >
              {/*
               * ICON
               */}
              <View style={styles.iconArea}>
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale,
                      },
                    ],
                  }}
                >
                  <Ionicons
                    name={
                      isFocused
                        ? icon?.active || "ellipse"
                        : icon?.inactive || "ellipse-outline"
                    }
                    size={21}
                    color={isFocused ? COLORS.white : COLORS.muted}
                  />

                  {route.name === "notifications" && (
                    <NotificationBadge count={unreadCount} />
                  )}
                </Animated.View>
              </View>

              {/*
               * LABEL
               */}
              <Text
                style={[styles.tabLabel, isFocused && styles.tabLabelActive]}
                numberOfLines={1}
              >
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
  /*
   * Phần bao ngoài
   */
  tabBarOuter: {
    backgroundColor: COLORS.white,

    borderTopWidth: 1,

    borderTopColor: COLORS.border,

    paddingTop: 7,

    paddingHorizontal: 10,
  },

  /*
   * Tab bar chính
   */
  tabBar: {
    height: 57,

    position: "relative",

    flexDirection: "row",

    alignItems: "flex-start",
  },

  /*
   * MẢNG CAM CHẠY QUA LẠI
   *
   * Đây chỉ là một View duy nhất.
   * Khi state.index thay đổi,
   * translateX được animate.
   */
  activeIndicator: {
    position: "absolute",

    top: 0,

    left: 0,

    height: 36,

    borderRadius: 12,

    backgroundColor: COLORS.orange,

    shadowColor: COLORS.orange,

    shadowOpacity: 0.18,

    shadowRadius: 7,

    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 3,
  },

  /*
   * Mỗi tab chiếm cùng
   * một phần chiều rộng.
   */
  tabItem: {
    flex: 1,

    height: 57,

    alignItems: "center",

    justifyContent: "flex-start",
  },

  /*
   * Vùng icon có cùng chiều cao
   * với indicator.
   */
  iconArea: {
    width: 42,

    height: 36,

    alignItems: "center",

    justifyContent: "center",
  },

  tabLabel: {
    marginTop: 4,

    fontSize: 10,

    lineHeight: 13,

    color: COLORS.muted,

    fontWeight: "600",
  },

  tabLabelActive: {
    color: COLORS.text,

    fontWeight: "800",
  },

  /*
   * Notification badge
   */
  badge: {
    position: "absolute",

    top: -7,

    right: -10,

    minWidth: 17,

    height: 17,

    paddingHorizontal: 3,

    borderRadius: 9,

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
