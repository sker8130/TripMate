import { useFocusEffect } from "@react-navigation/native";

import React, { ReactNode, useCallback, useRef } from "react";

import { Animated, Easing, StyleSheet } from "react-native";

/*
 * Ghi nhớ tab vừa active để biết
 * đang chuyển sang trái hay phải.
 */
let previousTabIndex: number | null = null;

type Props = {
  index: number;
  children: ReactNode;
};

export default function TabPageTransition({ index, children }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;

  const translateX = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      /*
       * Lần đầu mở app:
       * không cần animate.
       */
      if (previousTabIndex === null) {
        previousTabIndex = index;

        opacity.setValue(1);

        translateX.setValue(0);

        return;
      }

      /*
       * Qua tab bên phải:
       * content vào từ phải.
       *
       * Quay về tab bên trái:
       * content vào từ trái.
       */
      const direction = index > previousTabIndex ? 1 : -1;

      previousTabIndex = index;

      opacity.setValue(0.88);

      translateX.setValue(12 * direction);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,

          duration: 180,

          easing: Easing.out(Easing.cubic),

          useNativeDriver: true,
        }),

        Animated.timing(translateX, {
          toValue: 0,

          duration: 180,

          easing: Easing.out(Easing.cubic),

          useNativeDriver: true,
        }),
      ]).start();
    }, [index, opacity, translateX]),
  );

  return (
    <Animated.View
      style={[
        styles.container,

        {
          opacity,

          transform: [
            {
              translateX,
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
