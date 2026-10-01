import { Alert, Linking, Platform } from "react-native";
import { t } from "../i18n";

/**
 * Shape shared by every Expo permission hook response we use.
 * `canAskAgain === false` means the user has denied before and the OS will no
 * longer show the prompt — the only route left is the Settings app.
 */
export interface PermissionLike {
  granted: boolean;
  canAskAgain?: boolean;
}

interface EnsureOptions {
  /** Human name of the capability, used in the fallback alert. */
  label: string;
  /** Why the app needs it — shown when we must send the user to Settings. */
  reason: string;
  status: PermissionLike | null;
  request: () => Promise<PermissionLike>;
}

/**
 * Requests a permission at the point of use and reports whether the caller may
 * proceed. Never throws: a denied permission returns `false` so the calling
 * screen can stay usable instead of getting stuck.
 */
export async function ensurePermission({
  label,
  reason,
  status,
  request,
}: EnsureOptions): Promise<boolean> {
  try {
    if (status?.granted) return true;

    // Previously denied and the OS won't prompt again — offer Settings.
    if (status && status.canAskAgain === false) {
      promptOpenSettings(label, reason);
      return false;
    }

    const next = await request();
    if (next.granted) return true;

    if (next.canAskAgain === false) promptOpenSettings(label, reason);
    else {
      Alert.alert(
        t("{label} access needed", { label: t(label) }),
        t(reason),
        [{ text: t("OK") }],
        { cancelable: true }
      );
    }
    return false;
  } catch {
    Alert.alert(t("{label} unavailable", { label: t(label) }), t("{label} isn't available on this device.", { label: t(label) }));
    return false;
  }
}

function promptOpenSettings(label: string, reason: string) {
  Alert.alert(t("{label} access is off", { label: t(label) }), `${t(reason)}\n\n${t("You can turn it on in Settings.")}`, [
    { text: t("Not now"), style: "cancel" },
    {
      text: t("Open Settings"),
      onPress: () => {
        if (Platform.OS === "ios") Linking.openURL("app-settings:");
        else Linking.openSettings();
      },
    },
  ]);
}
