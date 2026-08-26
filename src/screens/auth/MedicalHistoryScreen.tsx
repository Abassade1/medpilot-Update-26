import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import StepFlowHeader from "../../components/StepFlowHeader";
import CheckRow from "../../components/CheckRow";
import Button from "../../components/Button";
import { spacing } from "../../theme";
import { medicalConditions } from "../../data/mock";
import { RootScreenProps } from "../../navigation/types";

export default function MedicalHistoryScreen({ navigation }: RootScreenProps<"MedicalHistory">) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (c: string) =>
    setSelected((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <ScreenContainer>
      <StepFlowHeader
        headerTitle="Medical History"
        step={1}
        totalSteps={2}
        title={"Select any past or existing\nmedical conditions"}
      />
      <View style={styles.body}>
        <View style={{ marginTop: 10 }}>
          {medicalConditions.map((c) => (
            <CheckRow
              key={c}
              label={c}
              checked={selected.includes(c)}
              onPress={() => toggle(c)}
              selectedStyle="filled"
            />
          ))}
        </View>
        <View style={styles.bottom}>
          <Button
            label="Proceed"
            variant="pill"
            disabled={selected.length === 0}
            onPress={() => navigation.navigate("UploadRecords")}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.lg },
  bottom: { marginTop: "auto", paddingBottom: 30 },
});
