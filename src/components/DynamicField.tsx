import React from "react";
import { Text, View, StyleSheet } from "react-native";
import TextField from "./TextField";
import SelectField from "./SelectField";
import CheckRow from "./CheckRow";
import { colors } from "../theme";
import type { FieldDef } from "../api/types";

interface Props {
  def: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}

/**
 * Renders one field from the taxonomy: text, number, single choice, multiple choice or yes/no. The
 * type-specific parts of the service form are built entirely from these, so a new provider type or
 * field appears in the app without a code change here.
 */
export default function DynamicField({ def, value, onChange, error }: Props) {
  const label = def.label;
  switch (def.input) {
    case "textarea":
      return (
        <TextField label={label} optional={!def.required} value={typeof value === "string" ? value : ""} onChangeText={onChange} multiline maxLength={500} error={error} />
      );
    case "number":
      return (
        <TextField
          label={label} optional={!def.required} keyboardType="number-pad"
          value={value === undefined || value === null ? "" : String(value)}
          onChangeText={(t) => onChange(t.replace(/\D/g, ""))} maxLength={6} error={error}
        />
      );
    case "select": {
      const opts = def.options ?? [];
      const current = opts.find((o) => o.value === value)?.label ?? null;
      return (
        <SelectField
          label={label} optional={!def.required} placeholder="Select" value={current} options={opts.map((o) => o.label)}
          onSelect={(l) => onChange(opts.find((o) => o.label === l)?.value)}
        />
      );
    }
    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <View style={{ marginBottom: 6 }}>
          <Text style={styles.label}>{label}{def.required ? "" : " (Optional)"}</Text>
          {(def.options ?? []).map((o) => (
            <CheckRow
              key={o.value} label={o.label} checked={selected.includes(o.value)}
              onPress={() => onChange(selected.includes(o.value) ? selected.filter((x) => x !== o.value) : [...selected, o.value])}
            />
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      );
    }
    case "toggle":
      return <CheckRow label={label} checked={value === true} onPress={() => onChange(!(value === true))} />;
    default:
      return (
        <TextField label={label} optional={!def.required} value={typeof value === "string" ? value : ""} onChangeText={onChange} maxLength={500} error={error} />
      );
  }
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "500", color: colors.text, marginBottom: 8 },
  error: { fontSize: 12, color: colors.error, marginTop: -4, marginBottom: 8 },
});
