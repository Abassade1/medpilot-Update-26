import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import ScreenContainer from "../../components/ScreenContainer";
import StepFlowHeader from "../../components/StepFlowHeader";
import Button from "../../components/Button";
import BottomSheet from "../../components/BottomSheet";
import ToastBanner from "../../components/ToastBanner";
import { ensurePermission } from "../../utils/permissions";
import { useSetupProgress } from "../../state/SetupProgress";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const MAX_FILES = 8;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file

interface FileItem {
  id: string;
  name: string;
  size: string;
  type: "doc" | "pdf" | "image";
  /** 0..1 — simulated locally until the upload API exists. */
  progress: number;
  failed?: boolean;
}

function kindOf(name: string, mime?: string | null): FileItem["type"] {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (n.endsWith(".doc") || n.endsWith(".docx")) return "doc";
  return "image";
}

const prettySize = (bytes?: number | null) =>
  bytes == null ? "—" : bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} kb`
    : `${(bytes / (1024 * 1024)).toFixed(1)} mb`;

export default function UploadRecordsScreen({ navigation }: RootScreenProps<"UploadRecords">) {
  const { markHistoryDone } = useSetupProgress();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [removeTarget, setRemoveTarget] = useState<FileItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Simulated upload progress (frontend-only until the API exists).
  useEffect(() => {
    if (!files.some((f) => f.progress < 1 && !f.failed)) return;
    const t = setInterval(() => {
      setFiles((prev) =>
        prev.map((f) =>
          f.progress < 1 && !f.failed ? { ...f, progress: Math.min(1, f.progress + 0.25) } : f
        )
      );
    }, 450);
    return () => clearInterval(t);
  }, [files]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const addFiles = useCallback(
    (incoming: FileItem[]) => {
      setFiles((prev) => {
        const room = MAX_FILES - prev.length;
        if (room <= 0) {
          Alert.alert("Limit reached", `You can upload up to ${MAX_FILES} files.`);
          return prev;
        }
        return [...prev, ...incoming.slice(0, room)];
      });
    },
    []
  );

  /** Browse the device for documents. */
  const browse = useCallback(async () => {
    if (busy) return; // guards rapid double-taps
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/msword", "image/*",
               "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return; // cancelled — silent, per spec

      const tooBig = res.assets.filter((a) => (a.size ?? 0) > MAX_BYTES);
      if (tooBig.length) {
        Alert.alert("File too large", `${tooBig[0].name} is over 10 MB and was skipped.`);
      }
      const picked = res.assets
        .filter((a) => (a.size ?? 0) <= MAX_BYTES)
        .map<FileItem>((a) => ({
          id: `${a.uri}-${Date.now()}`,
          name: a.name,
          size: prettySize(a.size),
          type: kindOf(a.name, a.mimeType),
          progress: 0,
        }));
      if (picked.length) addFiles(picked);
    } catch {
      Alert.alert("Couldn't open files", "The file picker isn't available right now.");
    } finally {
      setBusy(false);
    }
  }, [busy, addFiles]);

  /** Capture a record with the device camera. */
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
      addFiles([
        {
          id: `${a.uri}-${Date.now()}`,
          name: a.fileName ?? `record-${Date.now()}.jpg`,
          size: prettySize(a.fileSize),
          type: "image",
          progress: 0,
        },
      ]);
    } catch {
      Alert.alert("Camera unavailable", "The camera isn't available on this device.");
    } finally {
      setBusy(false);
    }
  }, [busy, addFiles]);

  const removeFile = useCallback(() => {
    if (!removeTarget) return;
    setFiles((prev) => prev.filter((f) => f.id !== removeTarget.id));
    setRemoveTarget(null);
    showToast("File removed successfully");
  }, [removeTarget, showToast]);

  const allUploaded = files.length > 0 && files.every((f) => f.progress >= 1 && !f.failed);

  const submit = useCallback(() => {
    if (submitting) return; // prevents multiple submissions
    setSubmitting(true);
    showToast("File Uploaded successfully");
    markHistoryDone();
    setTimeout(() => {
      setSubmitting(false);
      navigation.navigate("SetupChecklist");
    }, 900);
  }, [submitting, showToast, markHistoryDone, navigation]);

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

        {files.map((file) => {
          const uploading = file.progress < 1;
          return (
            <View key={file.id} style={styles.fileRow}>
              <View style={styles.fileTop}>
                <MaterialCommunityIcons
                  name={
                    file.type === "pdf"
                      ? "file-pdf-box"
                      : file.type === "doc"
                      ? "file-word-box"
                      : "file-image"
                  }
                  size={22}
                  color={file.type === "pdf" ? "#E02D2D" : file.type === "doc" ? "#2B579A" : "#3F7D2C"}
                />
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    uploading
                      ? setFiles((p) => p.filter((f) => f.id !== file.id))
                      : setRemoveTarget(file)
                  }
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={uploading ? `Cancel upload of ${file.name}` : `Remove ${file.name}`}
                >
                  <Ionicons
                    name={uploading ? "close-circle-outline" : "trash-outline"}
                    size={uploading ? 19 : 17}
                    color={uploading ? colors.secondaryText : colors.error}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.fileMeta}>
                {file.size}
                {"   ·   "}
                {uploading ? "Uploading…" : "Completed"}
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${file.progress * 100}%` },
                    !uploading && { backgroundColor: colors.success },
                  ]}
                />
              </View>
            </View>
          );
        })}

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
            loading={submitting}
            onPress={submit}
          />
          <TouchableOpacity
            style={styles.skip}
            onPress={() => {
              markHistoryDone();
              navigation.navigate("SetupChecklist");
            }}
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
