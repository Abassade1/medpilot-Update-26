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

const cap = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "Not set");

export default function ProfileScreen({ navigation }: RootScreenProps<"Profile">) {
  const me = useMe();
  const prefs = usePreferences();
  const contact = useEmergencyContact();
  const patchPrefs = usePatchPreferences();
  const { signOut } = useSession();
  const p = me.data?.profile;

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You'll need to sign in again to see your bookings.", [
      { text: "Stay signed in", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  const confirmDelete = () =>
    Alert.alert(
      "Delete your account?",
      "This permanently removes your profile, bookings and records. This can't be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            try {
              await endpoints.me.deleteAccount();
              await signOut();
            } catch (e) {
              Alert.alert("Couldn't delete your account", e instanceof ApiError ? e.message : "Please try again.");
            }
          },
        },
      ],
    );

  const toggle = (key: "pushEnabled" | "emailUpdates" | "appointmentReminders", label: string, hint: string) => (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.rowLabel}>{label}</Text>
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
      <AppHeader title="Profile" />
      {me.isPending ? (
        <ListStateView kind="loading" message="Loading your profile…" />
      ) : me.isError || !p ? (
        <ListStateView kind="error" message="We couldn't load your profile." onRetry={() => void me.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Image source={assetSource(p.avatarAsset, images.avatar)} style={styles.avatar} />
            <Text style={styles.name}>{p.fullName}</Text>
            <Text style={styles.email}>{me.data?.email}</Text>
            <View style={styles.plan}><Text style={styles.planText}>{me.data?.plan === "pro" ? "Pro member" : "Basic plan"}</Text></View>
          </View>

          <Section title="Personal information" action="Edit" onAction={() => navigation.navigate("EditProfile")}>
            <Row label="Name" value={p.fullName} />
            <Row label="Date of birth" value={formatDate(p.dateOfBirth) || "Not set"} />
            <Row label="Gender" value={cap(p.gender)} />
            <Row label="Marital status" value={cap(p.maritalStatus)} />
            <Row label="Location" value={p.locationLabel || "Not set"} />
          </Section>

          <Section title="Contact" action="Edit" onAction={() => navigation.navigate("EditProfile")}>
            <Row label="Email" value={me.data?.email ?? ""} hint={me.data?.emailVerified ? "Verified" : "Not verified"} />
            <Row label="Phone" value={p.phone || "Not set"} />
          </Section>

          <Section title="Emergency contact" action={contact.data?.contact ? "Edit" : "Add"} onAction={() => navigation.navigate("EmergencyContact")}>
            {contact.data?.contact ? (
              <>
                <Row label="Name" value={`${contact.data.contact.firstName} ${contact.data.contact.lastName}`} />
                <Row label="Phone" value={contact.data.contact.phone} />
                <Row label="Relationship" value={cap(contact.data.contact.relationship)} />
              </>
            ) : (
              <Text style={styles.empty}>{contact.isPending ? "Loading…" : "No emergency contact yet."}</Text>
            )}
          </Section>

          <Section title="Preferences">
            {prefs.isError ? (
              <Text style={styles.empty}>Couldn't load preferences. Pull back and try again.</Text>
            ) : (
              <>
                {toggle("pushEnabled", "Push notifications", "Booking updates on this device")}
                {toggle("emailUpdates", "Email updates", "Confirmations and receipts by email")}
                {toggle("appointmentReminders", "Appointment reminders", "A reminder before each confirmed visit")}
              </>
            )}
          </Section>

          <Section title="Security">
            <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate("ChangePassword")} accessibilityRole="button">
              <Ionicons name="key-outline" size={18} color={colors.primary} />
              <Text style={styles.linkText}>Change password</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.tertiaryText} />
            </TouchableOpacity>
          </Section>

          <TouchableOpacity style={styles.signOut} onPress={confirmSignOut} accessibilityRole="button">
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.delete} onPress={confirmDelete} accessibilityRole="button">
            <Text style={styles.deleteText}>Delete account</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <View style={styles.sectionHead}>
        <Text style={styles.section}>{title}</Text>
        {action ? (
          <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`${action} ${title.toLowerCase()}`}>
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
