import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import ScreenContainer from "../../components/ScreenContainer";
import StepFlowHeader from "../../components/StepFlowHeader";
import Button from "../../components/Button";
import BottomSheet from "../../components/BottomSheet";
import ToastBanner from "../../components/ToastBanner";
import ListStateView from "../../components/ListStateView";
import { ensurePermission } from "../../utils/permissions";
import { endpoints } from "../../api/endpoints";
import { uploadToSignedUrl } from "../../api/client";
import { ApiError } from "../../api/errors";
import { useDeleteRecord, useRecords } from "../../api/queries";
import { useSession } from "../../state/Session";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file

export default function UploadRecordsScreen({ navigation }: RootScreenProps<"UploadRecords">) {
  const { refreshSetup } = useSession();
  const records = useRecords();
  const deleteRecord = useDeleteRecord();
  const [removeTarget, setRemoveTarget] = useState<{ id: string; displayName: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);

  const files = records.data ?? [];
  const allUploaded = files.length > 0 && files.every((f) => f.status === "ready");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  /** Two-phase upload: presigned ticket, direct PUT, then attach the record. */
  const uploadOne = useCallback(async (file: { uri: string; name: string; mimeType: string; size: number; source: "upload" | "camera_scan" }) => {
    const label = file.name;
    setUploading((p) => [...p, label]);
    try {
      const ticket = await endpoints.me.recordUploadUrl({
        fileName: file.name, mimeType: file.mimeType, sizeBytes: file.size, source: file.source,
      });
      const blob = await (await fetch(file.uri)).blob();
      await uploadToSignedUrl(ticket.uploadUrl, blob, file.mimeType);
      await endpoints.me.createRecord({ fileId: ticket.fileId, displayName: file.name, source: file.source });
      await records.refetch();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Upload failed. Please try again.";
      Alert.alert("Couldn't upload that file", msg);
    } finally {
      setUploading((p) => p.filter((x) => x !== label));
    }
  }, [records]);

  /** Browse the device for documents and upload each selection. */
  const browse = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/msword", "image/*",
               "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return; // cancelled — silent, per spec
      for (const a of res.assets) {
        if ((a.size ?? 0) > MAX_BYTES) {
          Alert.alert("File too large", `${a.name} is over 10 MB and was skipped.`);
          continue;
        }
        await uploadOne({
          uri: a.uri, name: a.name,
          mimeType: a.mimeType ?? "application/pdf",
          size: a.size ?? 0, source: "upload",
        });
      }
    } catch {
      Alert.alert("Couldn't open files", "The file picker isn't available right now.");
    } finally {
      setBusy(false);
    }
  }, [busy, uploadOne]);

  /** Capture a record with the device camera and upload it. */
  const scan = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await ensurePermission({
        label: "Camera",
        reason: "MedPilot uses the camera so you can photograph a paper medical record.",
        status: await ImagePicker.getCameraPermissionsAsync(),
        request: ImagePicker.requestCameraPermissionsAsync,
      });
      if (!ok) return;
      const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (res.canceled) return;
      const a = res.assets[0];
      if (!a) return;
      await uploadOne({
        uri: a.uri,
        name: a.fileName ?? `record-${Date.now()}.jpg`,
        mimeType: a.mimeType ?? "image/jpeg",
        size: a.fileSize ?? 0,
        source: "camera_scan",
      });
    } catch {
      Alert.alert("Camera unavailable", "The camera isn't available on this device.");
    } finally {
      setBusy(false);
    }
  }, [busy, uploadOne]);

  const removeFile = useCallback(async () => {
    if (!removeTarget) return;
    try {
      await deleteRecord.mutateAsync(removeTarget.id);
      showToast("File removed successfully");
    } catch (e) {
      Alert.alert("Couldn't remove that file", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setRemoveTarget(null);
    }
  }, [removeTarget, deleteRecord, showToast]);

  const submit = useCallback(async () => {
    showToast("File Uploaded successfully");
    await refreshSetup();
    setTimeout(() => navigation.navigate("SetupChecklist"), 900);
  }, [showToast, refreshSetup, navigation]);

  return (
    <ScreenContainer>
      <ToastBanner message={toast ?? ""} visible={!!toast} />
      <StepFlowHeader
        headerTitle="Medical History"
        step={2}
        totalSteps={2}
        title="Upload Medical Records"
        subtitle="Compliance with medical privacy regulations"
      />
      <View style={styles.body}>
        <TouchableOpacity
          style={styles.uploadBox}
          activeOpacity={0.7}
          onPress={browse}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Browse and choose files to upload"
          accessibilityHint="Opens your device files. Jpeg, PNG, PDF or Docx"
        >
          <Ionicons name="cloud-upload-outline" size={20} color={colors.secondaryText} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.uploadTitle}>Browse and chose the files to upload</Text>
            <Text style={styles.uploadHint}>Jpeg, PNG, PDF or Docx</Text>
          </View>
        </TouchableOpacity>

        {records.isPending && <ListStateView kind="loading" message="Loading your records…" />}

        {files.map((file) => {
          const busyRow = file.status !== "ready";
          return (
            <View key={file.id} style={styles.fileRow}>
              <View style={styles.fileTop}>
                <MaterialCommunityIcons
                  name={
                    file.kind === "pdf" ? "file-pdf-box"
                      : file.kind === "doc" ? "file-word-box" : "file-image"
                  }
                  size={22}
                  color={file.kind === "pdf" ? "#E02D2D" : file.kind === "doc" ? "#2B579A" : "#3F7D2C"}
                />
                <Text style={styles.fileName} numberOfLines={1}>{file.displayName}</Text>
                <TouchableOpacity
                  onPress={() => setRemoveTarget({ id: file.id, displayName: file.displayName })}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${file.displayName}`}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.error} />
                </TouchableOpacity>
              </View>
              <Text style={styles.fileMeta}>
                {Math.max(1, Math.round(file.sizeBytes / 1024))} kb{"   ·   "}
                {busyRow ? "Uploading…" : "Completed"}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: "100%" }, !busyRow && { backgroundColor: colors.success }]} />
              </View>
            </View>
          );
        })}

        {uploading.map((name) => (
          <View key={name} style={styles.fileRow}>
            <View style={styles.fileTop}>
              <MaterialCommunityIcons name="file-upload-outline" size={22} color={colors.secondaryText} />
              <Text style={styles.fileName} numberOfLines={1}>{name}</Text>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
            <Text style={styles.fileMeta}>Uploading…</Text>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: "60%" }]} /></View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.scanBox}
          activeOpacity={0.7}
          onPress={scan}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Scan a record with the camera"
        >
          <MaterialCommunityIcons name="line-scan" size={18} color={colors.text} />
          <Text style={styles.scanText}>Scan with camera</Text>
        </TouchableOpacity>

        <View style={styles.bottom}>
          <Button
            label="Upload"
            variant="pill"
            disabled={!allUploaded}
            onPress={submit}
          />
          <TouchableOpacity
            style={styles.skip}
            onPress={() => navigation.navigate("SetupChecklist")}
            accessibilityRole="button"
            accessibilityLabel="Skip uploading medical records"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BottomSheet visible={!!removeTarget} onClose={() => setRemoveTarget(null)} maxHeightRatio={0.4}>
        <Text style={styles.sheetTitle}>Remove item?</Text>
        <Text style={styles.sheetSubtitle}>
          Are you sure want to remove this item from your uploaded files
        </Text>
        <Button label="Remove Item" variant="pill" onPress={removeFile} style={{ marginTop: 20 }} />
        <TouchableOpacity
          style={styles.skip}
          onPress={() => setRemoveTarget(null)}
          accessibilityRole="button"
        >
          <Text style={styles.skipText}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: 8 },
  uploadBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderStyle: "dashed",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  uploadTitle: { fontSize: 13, fontWeight: "500", color: colors.text },
  uploadHint: { fontSize: 11.5, color: colors.secondaryText, marginTop: 2 },
  fileRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  fileTop: { flexDirection: "row", alignItems: "center" },
  fileName: { flex: 1, fontSize: 12.5, color: colors.text, marginHorizontal: 8 },
  fileMeta: { fontSize: 11, color: colors.secondaryText, marginTop: 5, marginLeft: 30 },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: colors.surfaceAlt, marginTop: 8 },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: colors.primary },
  scanBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    height: 46,
  },
  scanText: { fontSize: 13, fontWeight: "500", color: colors.text, marginLeft: 12 },
  bottom: { marginTop: "auto", paddingBottom: 30 },
  skip: { alignItems: "center", marginTop: 16, paddingVertical: 6 },
  skipText: { fontSize: 13.5, fontWeight: "600", color: colors.text, textDecorationLine: "underline" },
  sheetTitle: { fontSize: 19, fontWeight: "700", color: colors.text, textAlign: "center", marginTop: 6 },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.secondaryText,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 19,
  },
});
