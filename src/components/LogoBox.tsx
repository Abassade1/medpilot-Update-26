import React from "react";
import { View, Text, Image, StyleSheet, ImageSourcePropType } from "react-native";
import { colors, radii } from "../theme";

interface Props {
  text: string;
  color: string;
  size?: number;
  dark?: boolean;
  /** Real logo asset — rendered inside a bordered white tile when provided. */
  image?: ImageSourcePropType;
}

export default function LogoBox({ text, color, size = 42, dark, image }: Props) {
  if (image) {
    return (
      <View style={[styles.box, styles.imageBox, { width: size, height: size }]}>
        <Image
          source={image}
          style={{ width: size - 4, height: size - 4, borderRadius: radii.xs }}
          resizeMode="contain"
        />
      </View>
    );
  }

  const isDark = dark ?? isDarkColor(color);
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          backgroundColor: color,
          borderColor: isDark ? color : colors.border,
        },
      ]}
    >
      <Text
        style={{
          color: isDark ? "#fff" : colors.text,
          fontWeight: "700",
          fontSize: text.length > 3 ? size * 0.22 : size * 0.3,
        }}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

function isDarkColor(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imageBox: {
    backgroundColor: "#fff",
    borderColor: colors.borderLight,
    overflow: "hidden",
  },
});
