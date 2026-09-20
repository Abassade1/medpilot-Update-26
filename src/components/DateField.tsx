import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import TextField from "./TextField";
import BottomSheet from "./BottomSheet";
import Button from "./Button";
import { colors } from "../theme";
import {
  fromIso, toIso, maskDate, maskTime, validateIso, validateTime, timeToDate, toHHMM, formatDate, formatTime,
} from "../utils/dates";

interface Props {
  label?: string;
  optional?: boolean;
  mode?: "date" | "time";
  /** YYYY-MM-DD (date) or HH:MM (time); null while empty or incomplete. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Inclusive bounds, YYYY-MM-DD. Enforced for typing AND for the calendar. */
  min?: string;
  max?: string;
  minMessage?: string;
  maxMessage?: string;
  /** Shows a clear button. Leave off for required fields. */
  clearable?: boolean;
  placeholder?: string;
  /** External error, e.g. one the server raised. Shown in place of the local one. */
  error?: string;
  /** Where the calendar opens when the field is empty (e.g. a birth year). */
  pickerStart?: string;
  /** Shown once the member has visited the field and left it empty. Omit for optional fields. */
  requiredMessage?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * One date/time input for the whole app: the member can type it (digits only,
 * hyphens and colons are inserted) or open the platform's native picker, and
 * both edit the same value. The native calendar cannot produce an impossible
 * date; typed input is validated as it completes.
 *
 * The value it reports is always a valid YYYY-MM-DD / HH:MM inside min..max, or
 * null — so a parent that gates on `value !== null` can never submit garbage.
 */
export default function DateField({
  label, optional, mode = "date", value, onChange, min, max, minMessage, maxMessage,
  clearable, placeholder, error, pickerStart, requiredMessage, containerStyle,
}: Props) {
  const isDate = mode === "date";
  const length = isDate ? 10 : 5;
  const [text, setText] = useState(value ?? "");
  const [touched, setTouched] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());
  const emitted = useRef<string | null>(value);

  // Follow the parent when it sets or resets the value from outside.
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setText(value ?? "");
      if (value === null) setTouched(false);
    }
  }, [value]);

  const rule = { min, max, minMessage, maxMessage };
  const validate = useCallback(
    (v: string) => (isDate ? validateIso(v, rule) : validateTime(v)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDate, min, max, minMessage, maxMessage],
  );

  const commit = useCallback((next: string | null) => {
    emitted.current = next;
    onChange(next);
  }, [onChange]);

  const onType = (raw: string) => {
    const masked = isDate ? maskDate(raw) : maskTime(raw);
    setText(masked);
    commit(masked.length === length && !validate(masked) ? masked : null);
  };

  const localError = text.length === length ? validate(text) : undefined;
  const incomplete = touched && text.length > 0 && text.length < length
    ? `Enter the ${isDate ? "date as YYYY-MM-DD" : "time as HH:MM (24-hour)"}`
    : undefined;
  const empty = touched && text.length === 0 ? requiredMessage : undefined;
  const shown = error ?? localError ?? incomplete ?? empty;

  /** Where the picker opens: the current value, else the caller's hint, else today — kept inside the bounds. */
  const seed = (): Date => {
    if (!isDate) return timeToDate(value);
    const start = (value && fromIso(value)) || (pickerStart && fromIso(pickerStart)) || new Date();
    const lo = min ? fromIso(min) : null;
    const hi = max ? fromIso(max) : null;
    if (lo && start < lo) return lo;
    if (hi && start > hi) return hi;
    return start;
  };

  const pick = (d: Date) => {
    const next = isDate ? toIso(d) : toHHMM(d);
    setText(next);
    setTouched(true);
    commit(next);
  };

  const open = () => {
    const start = seed();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: start,
        mode,
        is24Hour: true,
        minimumDate: isDate && min ? fromIso(min) ?? undefined : undefined,
        maximumDate: isDate && max ? fromIso(max) ?? undefined : undefined,
        onValueChange: (_e, d) => pick(d),
      });
      return;
    }
    setDraft(start);
    setSheet(true);
  };

  const clear = () => {
    setText("");
    setTouched(false);
    commit(null);
  };

  return (
    <>
      <TextField
        label={label}
        optional={optional}
        placeholder={placeholder ?? (isDate ? "YYYY-MM-DD" : "HH:MM")}
        value={text}
        onChangeText={onType}
        onBlur={() => setTouched(true)}
        keyboardType="number-pad"
        maxLength={length}
        error={shown}
        containerStyle={containerStyle}
        accessibilityLabel={`${label ?? (isDate ? "Date" : "Time")}${
          value ? `, ${isDate ? formatDate(value) : formatTime(value)}` : ""
        }`}
        right={
          <View style={styles.actions}>
            {clearable && text.length > 0 ? (
              <TouchableOpacity
                onPress={clear}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Clear ${label ?? (isDate ? "date" : "time")}`}
              >
                <Ionicons name="close-circle" size={18} color={colors.tertiaryText} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={open}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isDate ? "Open calendar" : "Open time picker"}
            >
              <Ionicons
                name={isDate ? "calendar-outline" : "time-outline"}
                size={19}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        }
      />

      {Platform.OS === "ios" ? (
        <BottomSheet visible={sheet} onClose={() => setSheet(false)} maxHeightRatio={0.8}>
          <Text style={styles.sheetTitle}>{label ?? (isDate ? "Select a date" : "Select a time")}</Text>
          <DateTimePicker
            value={draft}
            mode={mode}
            display={isDate ? "inline" : "spinner"}
            is24Hour
            accentColor={colors.primary}
            themeVariant="light"
            minimumDate={isDate && min ? fromIso(min) ?? undefined : undefined}
            maximumDate={isDate && max ? fromIso(max) ?? undefined : undefined}
            onValueChange={(_e, d) => setDraft(d)}
          />
          <Button
            label="Done"
            onPress={() => { pick(draft); setSheet(false); }}
            style={styles.done}
          />
          {clearable && value ? (
            <TouchableOpacity style={styles.clearLink} onPress={() => { clear(); setSheet(false); }}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </BottomSheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: 6 },
  done: { marginTop: 8, marginHorizontal: 12, borderRadius: 24 },
  clearLink: { alignItems: "center", paddingVertical: 12 },
  clearText: { fontSize: 13.5, fontWeight: "600", color: colors.secondaryText, textDecorationLine: "underline" },
});
