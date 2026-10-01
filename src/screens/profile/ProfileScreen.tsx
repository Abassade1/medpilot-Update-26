import React from "react";
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import ListStateView from "../../components/ListStateView";
import { useEmergencyContact, useMe, usePatchPreferences, usePreferences } from "../../api/queries";
import { endpoints } from "../../api/endpoints";
import { assetSource } from "../../api/assets";
import { ApiError } from "../../api/errors";
import { useSession } from "../../state/Session";
import { images } from "../../data/assets";
import { formatDate } from "../../utils/dates";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";
import { LANGUAGES, t, useLanguage, useT, rtlFlip } from "../../i18n";

const cap = (s: string | null | undefined) => (s ? t(s.charAt(0).toUpperCase() + s.slice(1)) : t("Not set"));

export default function ProfileScreen({ navigation }: RootScreenProps<"Profile">) {
  const tr = useT();
  const { language, setLanguage } = useLanguage();
  const me = useMe();
  const prefs = usePreferences();
  const contact = useEmergencyContact();
  const patchPrefs = usePatchPreferences();
  const { signOut } = useSession();
  const p = me.data?.profile;

  const confirmSignOut = () =>
    Alert.alert(tr("Sign out?"), tr("You'll need to sign in again to see your bookings."), [
      { text: tr("Stay signed in"), style: "cancel" },
      { text: tr("Sign out"), style: "destructive", onPress: () => void signOut() },
    ]);

  const confirmDelete = () =>
    Alert.alert(
      tr("Delete your account?"),
      tr("This permanently removes your profile, bookings and records. This can't be undone."),
      [
        { text: tr("Keep my account"), style: "cancel" },
        {
          text: tr("Delete account"),
          style: "destructive",
          onPress: async () => {
            try {
              await endpoints.me.deleteAccount();
              await signOut();
            } catch (e) {
              Alert.alert(tr("Couldn't delete your account"), e instanceof ApiError ? e.message : tr("Please try again."));
            }
          },
        },
      ],
    );

  const toggle = (key: "pushEnabled" | "emailUpdates" | "appointmentReminders", label: string, hint: string) => (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={!!prefs.data?.[key]}
        disabled={!prefs.data}
        onValueChange={(v) => patchPrefs.mutate({ [key]: v })}
        trackColor={{ true: colors.primary }}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <ScreenContainer>
      <AppHeader title={tr("Profile")} />
      {me.isPending ? (
        <ListStateView kind="loading" message={tr("Loading your profile…")} />
      ) : me.isError || !p ? (
        <ListStateView kind="error" message={tr("We couldn't load your profile.")} onRetry={() => void me.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Image source={assetSource(p.avatarAsset, images.avatar)} style={styles.avatar} />
            <Text style={styles.name}>{p.fullName}</Text>
            <Text style={styles.email}>{me.data?.email}</Text>
            <View style={styles.plan}><Text style={styles.planText}>{me.data?.plan === "pro" ? tr("Pro member") : tr("Basic plan")}</Text></View>
          </View>

          <Section title={tr("Personal information")} action={tr("Edit")} onAction={() => navigation.navigate("EditProfile")}>
            <Row label={tr("Name")} value={p.fullName} />
            <Row label={tr("Date of birth")} value={formatDate(p.dateOfBirth) || tr("Not set")} />
            <Row label={tr("Gender")} value={cap(p.gender)} />
            <Row label={tr("Marital status")} value={cap(p.maritalStatus)} />
            <Row label={tr("Location")} value={p.locationLabel || tr("Not set")} />
          </Section>

          <Section title={tr("Contact")} action={tr("Edit")} onAction={() => navigation.navigate("EditProfile")}>
            <Row label={tr("Email")} value={me.data?.email ?? ""} hint={me.data?.emailVerified ? tr("Verified") : tr("Not verified")} />
            <Row label={tr("Phone")} value={p.phone || tr("Not set")} />
          </Section>

          <Section title={tr("Emergency contact")} action={contact.data?.contact ? tr("Edit") : tr("Add")} onAction={() => navigation.navigate("EmergencyContact")}>
            {contact.data?.contact ? (
              <>
                <Row label={tr("Name")} value={`${contact.data.contact.firstName} ${contact.data.contact.lastName}`} />
                <Row label={tr("Phone")} value={contact.data.contact.phone} />
                <Row label={tr("Relationship")} value={cap(contact.data.contact.relationship)} />
              </>
            ) : (
              <Text style={styles.empty}>{contact.isPending ? tr("Loading…") : tr("No emergency contact yet.")}</Text>
            )}
          </Section>

          <Section title={tr("Preferences")}>
            {prefs.isError ? (
              <Text style={styles.empty}>{tr("Couldn't load preferences. Pull back and try again.")}</Text>
            ) : (
              <>
                {toggle("pushEnabled", tr("Push notifications"), tr("Booking updates on this device"))}
                {toggle("emailUpdates", tr("Email updates"), tr("Confirmations and receipts by email"))}
                {toggle("appointmentReminders", tr("Appointment reminders"), tr("A reminder before each confirmed visit"))}
              </>
            )}
          </Section>

          <Section title={tr("Language")}>
            {LANGUAGES.map((l) => (
              <TouchableOpacity key={l.code} style={styles.linkRow} accessibilityRole="radio" accessibilityState={{ selected: language === l.code }}
                onPress={() => { setLanguage(l.code); patchPrefs.mutate({ language: l.code }); }}>
                <Text style={[styles.linkText, { marginLeft: 0 }]}>{l.native}</Text>
                {language === l.code ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </TouchableOpacity>
            ))}
          </Section>

          <Section title={tr("Provider")}>
            <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate("ProviderHome")} accessibilityRole="button">
              <Ionicons name="storefront-outline" size={18} color={colors.primary} />
              <Text style={styles.linkText}>{tr("Provider portal")}</Text>
              <Ionicons style={rtlFlip()} name="chevron-forward" size={16} color={colors.tertiaryText} />
            </TouchableOpacity>
          </Section>

          <Section title={tr("Security")}>
            <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate("ChangePassword")} accessibilityRole="button">
              <Ionicons name="key-outline" size={18} color={colors.primary} />
              <Text style={styles.linkText}>{tr("Change password")}</Text>
              <Ionicons style={rtlFlip()} name="chevron-forward" size={16} color={colors.tertiaryText} />
            </TouchableOpacity>
          </Section>

          <TouchableOpacity style={styles.signOut} onPress={confirmSignOut} accessibilityRole="button">
            <Text style={styles.signOutText}>{tr("Sign out")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.delete} onPress={confirmDelete} accessibilityRole="button">
            <Text style={styles.deleteText}>{tr("Delete account")}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  const tr = useT();
  return (
    <View style={{ marginTop: 18 }}>
      <View style={styles.sectionHead}>
        <Text style={styles.section}>{title}</Text>
        {action ? (
          <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={tr("{action} {section}", { action, section: title.toLowerCase() })}>
            <Text style={styles.action}>{action}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={styles.rowValue}>{value}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  hero: { alignItems: "center", paddingTop: 8 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceAlt },
  name: { fontSize: 19, fontWeight: "700", color: colors.text, marginTop: 10 },
  email: { fontSize: 13, color: colors.secondaryText, marginTop: 2 },
  plan: { marginTop: 8, backgroundColor: colors.primaryLight, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  planText: { fontSize: 12, fontWeight: "600", color: colors.primary },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  section: { fontSize: 13, fontWeight: "700", color: colors.secondaryText, textTransform: "uppercase", letterSpacing: 0.4 },
  action: { fontSize: 13.5, fontWeight: "600", color: colors.primary },
  card: { backgroundColor: "#fff", borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 9 },
  rowLabel: { fontSize: 13.5, color: colors.text, width: 118 },
  toggleLabel: { fontSize: 13.5, color: colors.text },
  rowValue: { fontSize: 13.5, fontWeight: "600", color: colors.text, textAlign: "right" },
  hint: { fontSize: 11.5, color: colors.secondaryText, marginTop: 1 },
  empty: { fontSize: 13, color: colors.secondaryText, paddingVertical: 10 },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9 },
  linkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  linkText: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: "500", color: colors.text },
  signOut: { marginTop: 26, borderWidth: 1, borderColor: colors.primary, borderRadius: 26, paddingVertical: 13, alignItems: "center" },
  signOutText: { fontSize: 15, fontWeight: "600", color: colors.primary },
  delete: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
  deleteText: { fontSize: 13.5, fontWeight: "600", color: colors.error },
});
