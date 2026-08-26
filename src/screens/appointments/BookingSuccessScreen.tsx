import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import Button from "../../components/Button";
import { images } from "../../data/mock";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function BookingSuccessScreen({
  navigation,
  route,
}: RootScreenProps<"BookingSuccess">) {
  const reference = route.params?.reference;
  const kind = route.params?.kind ?? "appointment";
  return (
    <ScreenContainer>
      <View style={styles.body}>
        <View>
          <Image source={images.illusRecords} style={styles.illustration} resizeMode="contain" />
          <View style={styles.badge}>
            <Ionicons name="checkmark" size={26} color="#fff" />
          </View>
        </View>
        <Text style={styles.title}>
          {kind === "transport" ? "Transport Requested" : "Appointment Booked"}
        </Text>
        <Text style={styles.subtitle}>
          Your booking has been successful.{"\n"}A representative will be in contact shortly
        </Text>
        {reference ? <Text style={styles.reference}>Booking ID {reference}</Text> : null}
        <Button
          label="Done"
          variant="pill"
          onPress={() => navigation.navigate("MainTabs")}
          style={{ marginTop: 26 }}
        />
        <TouchableOpacity
          style={styles.link}
          onPress={() =>
            navigation.navigate("MainTabs", { screen: "AppointmentsTab" } as never)
          }
        >
          <Text style={styles.linkText}>View appointments</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  illustration: { width: 250, height: 210 },
  badge: {
    position: "absolute",
    alignSelf: "center",
    top: 62,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 30 },
  reference: { fontSize: 12.5, fontWeight: "600", color: colors.primary, marginTop: 10 },
  subtitle: {
    fontSize: 13,
    color: colors.secondaryText,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 10,
  },
  link: { marginTop: 18 },
  linkText: { fontSize: 13.5, fontWeight: "600", color: colors.primary, textDecorationLine: "underline" },
});
