import React, { useEffect, useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import StepFlowHeader from "../../components/StepFlowHeader";
import CheckRow from "../../components/CheckRow";
import Button from "../../components/Button";
import { spacing } from "../../theme";
import ListStateView from "../../components/ListStateView";
import { useConditions, usePutConditions } from "../../api/queries";
import { endpoints } from "../../api/endpoints";
import { useSession } from "../../state/Session";
import { useQuery } from "@tanstack/react-query";

import { RootScreenProps } from "../../navigation/types";

export default function MedicalHistoryScreen({ navigation }: RootScreenProps<"MedicalHistory">) {
  const { refreshSetup } = useSession();
  const reference = useQuery({
    queryKey: ["reference"],
    queryFn: endpoints.catalog.reference,
    staleTime: 5 * 60_000,
  });
  const conditionsQuery = useQuery({
    queryKey: ["conditionOptions"],
    queryFn: () => endpoints.catalog.reference().then(() => endpoints.me.conditions()),
    enabled: false,
  });
  const saved = useConditions();
  const putConditions = usePutConditions();
  const [selected, setSelected] = useState<string[]>([]);

  // Options come from the reference list; prior answers preselect the rows.
  const options = optionsFrom(reference.data);
  useEffect(() => {
    if (saved.data?.length) setSelected(saved.data.map((c) => c.id));
  }, [saved.data]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const proceed = async () => {
    try {
      await putConditions.mutateAsync(selected);
      await refreshSetup();
      navigation.navigate("UploadRecords");
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : "Please try again.");
    }
  };
  void conditionsQuery;

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
          {reference.isPending ? (
            <ListStateView kind="loading" message="Loading conditions…" />
          ) : reference.isError ? (
            <ListStateView kind="error" onRetry={() => void reference.refetch()} />
          ) : (
            options.map((c) => (
              <CheckRow
                key={c.id}
                label={c.label}
                checked={selected.includes(c.id)}
                onPress={() => toggle(c.id)}
                selectedStyle="filled"
              />
            ))
          )}
        </View>
        <View style={styles.bottom}>
          <Button
            label="Proceed"
            variant="pill"
            disabled={selected.length === 0}
            loading={putConditions.isPending}
            onPress={proceed}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

/** The API exposes conditions through the reference endpoint. */
function optionsFrom(ref: { conditions?: { id: string; label: string }[] } | undefined) {
  return ref?.conditions ?? [];
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.lg },
  bottom: { marginTop: "auto", paddingBottom: 30 },
});
