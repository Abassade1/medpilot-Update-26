import React, { useCallback, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { endpoints } from "../api/endpoints";
import { uploadToSignedUrl } from "../api/client";
import { ApiError } from "../api/errors";
import { ensurePermission } from "../utils/permissions";
import { colors, radii } from "../theme";

const MAX_BYTES = 8 * 1024 * 1024;

async function pickAndUpload(): Promise<string | null> {
  const ok = await ensurePermission({
    label: "Photos",
    reason: "MedPilot needs access to your photos so you can add an image.",
    status: await ImagePicker.getMediaLibraryPermissionsAsync(),
    request: ImagePicker.requestMediaLibraryPermissionsAsync,
  });
  if (!ok) return null;

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  const mimeType = asset.mimeType === "image/png" ? "image/png" : "image/jpeg";
  const size = asset.fileSize ?? 0;
  if (size > MAX_BYTES) {
    throw new ApiError({ code: "file_too_large", status: 413, message: `Photos must be under ${MAX_BYTES / 1024 / 1024} MB.` });
  }

  const blob = await (await fetch(asset.uri)).blob();
  const ticket = await endpoints.provider.imageUploadUrl(mimeType, size || blob.size);
  await uploadToSignedUrl(ticket.uploadUrl, blob, mimeType);
  const { url } = await endpoints.provider.confirmImage(ticket.fileId);
  return url;
}

/** A single-image picker: logo, cover, or one slot of a listing's photo gallery. */
export function ImagePickerSlot({ label, value, onChange, onError }: {
  label: string; value: string | null; onChange: (url: string | null) => void; onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const pick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const url = await pickAndUpload();
      if (url) onChange(url);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "That upload didn't go through. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, onChange, onError]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label} <Text style={styles.optional}>(Optional)</Text></Text>
      <TouchableOpacity style={styles.slot} onPress={pick} disabled={busy} accessibilityRole="button" accessibilityLabel={value ? `Replace ${label}` : `Add ${label}`}>
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : value ? (
          <Image source={{ uri: value }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="image-outline" size={22} color={colors.tertiaryText} />
            <Text style={styles.emptyText}>Tap to upload</Text>
          </View>
        )}
      </TouchableOpacity>
      {value && !busy ? (
        <TouchableOpacity onPress={() => onChange(null)} accessibilityRole="button" accessibilityLabel={`Remove ${label}`}>
          <Text style={styles.remove}>Remove</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** A gallery of up to `max` images, e.g. a listing's photo set. */
export function ImagePickerGallery({ label, values, onChange, onError, max = 8 }: {
  label: string; values: string[]; onChange: (urls: string[]) => void; onError: (msg: string) => void; max?: number;
}) {
  const [busy, setBusy] = useState(false);

  const add = useCallback(async () => {
    if (busy || values.length >= max) return;
    setBusy(true);
    try {
      const url = await pickAndUpload();
      if (url) onChange([...values, url]);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "That upload didn't go through. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, values, onChange, onError, max]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label} <Text style={styles.optional}>(Optional, up to {max})</Text></Text>
      <View style={styles.gallery}>
        {values.map((url) => (
          <View key={url} style={styles.thumbWrap}>
            <Image source={{ uri: url }} style={styles.thumb} resizeMode="cover" />
            <TouchableOpacity
              style={styles.thumbRemove}
              onPress={() => onChange(values.filter((v) => v !== url))}
              accessibilityRole="button"
              accessibilityLabel="Remove this photo"
            >
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {values.length < max ? (
          <TouchableOpacity style={[styles.thumb, styles.addThumb]} onPress={add} disabled={busy} accessibilityRole="button" accessibilityLabel="Add a photo">
            {busy ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="add" size={22} color={colors.primary} />}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "500", color: colors.text, marginBottom: 8 },
  optional: { color: colors.tertiaryText, fontWeight: "400" },
  slot: {
    width: "100%", height: 120, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    borderStyle: "dashed", alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: colors.surfaceAlt,
  },
  preview: { width: "100%", height: "100%" },
  empty: { alignItems: "center" },
  emptyText: { fontSize: 12, color: colors.tertiaryText, marginTop: 6 },
  remove: { fontSize: 12.5, color: colors.error, marginTop: 8, fontWeight: "600" },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  thumbWrap: { position: "relative" },
  thumb: {
    width: 84, height: 84, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  addThumb: { borderStyle: "dashed" },
  thumbRemove: {
    position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.error, alignItems: "center", justifyContent: "center",
  },
});
