import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { CameraView, CameraType, FlashMode, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "../../components/Button";
import { ensurePermission } from "../../utils/permissions";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const CAMERA_REASON =
  "MedPilot uses the camera to scan your meal and estimate its nutritional breakdown.";

/**
 * Meal-analysis capture. Uses the real device camera; the permission prompt is
 * raised only when the user opens this screen (point of use), and a denial
 * leaves the screen usable via the photo-library fallback.
 */
export default function MealCameraScreen({ navigation }: RootScreenProps<"MealCamera">) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const askForCamera = useCallback(async () => {
    await ensurePermission({
      label: "Camera",
      reason: CAMERA_REASON,
      status: permission,
      request: requestPermission,
    });
  }, [permission, requestPermission]);

  /** Fallback path when the camera is denied or unavailable. */
  const pickFromLibrary = useCallback(async () => {
    const ok = await ensurePermission({
      label: "Photos",
      reason: "MedPilot needs access to your photos so you can analyse an existing meal photo.",
      status: await ImagePicker.getMediaLibraryPermissionsAsync(),
      request: ImagePicker.requestMediaLibraryPermissionsAsync,
    });
    if (!ok) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (result.canceled) return; // user cancelled — stay put, no error
    navigation.replace("MealAnalyzing");
  }, [navigation]);

  const capture = useCallback(async () => {
    if (capturing || !ready) return; // guards double-taps on the shutter
    setCapturing(true);
    try {
      await cameraRef.current?.takePictureAsync({ quality: 0.7, skipProcessing: true });
      navigation.replace("MealAnalyzing");
    } catch {
      Alert.alert("Couldn't take the photo", "Something went wrong. Please try again.");
    } finally {
      setCapturing(false);
    }
  }, [capturing, ready, navigation]);

  // Permission state still resolving.
  if (!permission) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  // Denied / not yet granted — explain, offer retry and a library fallback.
  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.center, { paddingHorizontal: spacing.xl }]}>
        <TouchableOpacity
          style={[styles.roundBtn, styles.closeAbsolute, { top: insets.top + 8 }]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close camera"
        >
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>

        <Ionicons name="camera-outline" size={46} color="#8E959F" />
        <Text style={styles.deniedTitle}>Camera access needed</Text>
        <Text style={styles.deniedBody}>{CAMERA_REASON}</Text>
        <Button label="Allow camera" variant="pill" onPress={askForCamera} style={{ marginTop: 22 }} />
        <TouchableOpacity
          style={styles.libraryLink}
          onPress={pickFromLibrary}
          accessibilityRole="button"
        >
          <Text style={styles.libraryLinkText}>Choose a photo instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        onCameraReady={() => setReady(true)}
      />

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.roundBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close camera"
        >
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFlash((f) => (f === "off" ? "on" : "off"))}
          accessibilityRole="button"
          accessibilityLabel={flash === "on" ? "Turn flash off" : "Turn flash on"}
          accessibilityState={{ selected: flash === "on" }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={flash === "on" ? "flash" : "flash-off"} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.frame} pointerEvents="none">
        <View style={[styles.bracket, styles.brTL]} />
        <View style={[styles.bracket, styles.brTR]} />
        <View style={[styles.bracket, styles.brBL]} />
        <View style={[styles.bracket, styles.brBR]} />
        <View style={styles.scanLine} />
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            onPress={pickFromLibrary}
            accessibilityRole="button"
            accessibilityLabel="Choose a photo from your library"
          >
            <View style={styles.galleryThumb}>
              <Ionicons name="images-outline" size={18} color="#fff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shutterOuter}
            activeOpacity={0.8}
            onPress={capture}
            disabled={capturing || !ready}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityState={{ disabled: capturing || !ready }}
          >
            <View style={[styles.shutterInner, (capturing || !ready) && styles.shutterBusy]}>
              {capturing && <ActivityIndicator color={colors.primary} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
            accessibilityRole="button"
            accessibilityLabel="Switch camera"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.modeRow}>
          <Text style={[styles.mode, styles.modeActive]}>PHOTO</Text>
          <Text style={styles.mode}>VIDEO</Text>
        </View>
      </View>
    </View>
  );
}

const BRACKET = 42;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center" },
  closeAbsolute: { position: "absolute", left: 18 },
  deniedTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 18 },
  deniedBody: {
    color: "#C9CDD4",
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  libraryLink: { marginTop: 18, padding: 8 },
  libraryLinkText: { color: "#fff", fontSize: 13.5, fontWeight: "600", textDecorationLine: "underline" },
  topBar: {
    position: "absolute",
    left: 18,
    right: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 2,
  },
  roundBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  frame: { position: "absolute", top: "22%", left: 36, right: 36, height: "38%" },
  bracket: {
    position: "absolute",
    width: BRACKET,
    height: BRACKET,
    borderColor: "#fff",
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
  },
  brTL: { top: 0, left: 0, borderTopLeftRadius: 6 },
  brTR: { top: 0, right: 0, transform: [{ rotate: "90deg" }], borderTopLeftRadius: 6 },
  brBL: { bottom: 0, left: 0, transform: [{ rotate: "270deg" }], borderTopLeftRadius: 6 },
  brBR: { bottom: 0, right: 0, transform: [{ rotate: "180deg" }], borderTopLeftRadius: 6 },
  scanLine: {
    position: "absolute",
    top: "45%",
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#5BE12C",
  },
  controls: { position: "absolute", left: 0, right: 0, bottom: 0 },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 34,
  },
  galleryThumb: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterBusy: { backgroundColor: "#D7DBE0" },
  modeRow: { flexDirection: "row", justifyContent: "center", marginTop: 14 },
  mode: { color: "#C9CDD4", fontSize: 11.5, fontWeight: "600", marginHorizontal: 10, letterSpacing: 0.6 },
  modeActive: { color: "#F5C242" },
});
