import React, { useState } from "react";
import { StyleProp, Text, TextStyle } from "react-native";
import { colors } from "../theme";
import { useT } from "../i18n";

/** Long copy clamped to a preview, with a working Read More / Show less toggle. */
export default function ExpandableText({
  text, limit = 140, style,
}: { text: string; limit?: number; style?: StyleProp<TextStyle> }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const long = text.length > limit;
  return (
    <Text style={style}>
      {open || !long ? text : `${text.slice(0, limit).trimEnd()}… `}
      {long ? (
        <Text style={{ color: colors.primary, fontWeight: "600" }} onPress={() => setOpen((v) => !v)} accessibilityRole="button">
          {open ? ` ${tr("Show less")}` : tr("Read More")}
        </Text>
      ) : null}
    </Text>
  );
}
