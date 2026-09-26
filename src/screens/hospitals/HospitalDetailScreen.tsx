import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Chip from "../../components/Chip";
import PlaceBadges from "../../components/PlaceBadges";
import ExpandableText from "../../components/ExpandableText";
import InfoRow from "../../components/InfoRow";
import SpecialistCard from "../../components/SpecialistCard";
import Button from "../../components/Button";
import ReviewsList from "../../components/ReviewsList";
import BottomSheet from "../../components/BottomSheet";
import LogoBox from "../../components/LogoBox";
import Rating from "../../components/Rating";
import { useHospital, useSpecialist } from "../../api/queries";
import { assetSource } from "../../api/assets";
import ListStateView from "../../components/ListStateView";
import { images } from "../../data/assets";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function HospitalDetailScreen({ navigation, route }: RootScreenProps<"HospitalDetail">) {
  const query = useHospital(route.params.hospitalId);
  const hospital = query.data;
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const specialistQuery = useSpecialist(selectedId);
  const selectedSpecialist = specialistQuery.data;

  return (
    <ScreenContainer>
      <AppHeader
        title="Hospital"
      />
      {!hospital ? (
        query.isError ? (
          <ListStateView kind="error" onRetry={() => void query.refetch()} />
        ) : (
          <ListStateView kind="loading" message="Loading hospital…" />
        )
      ) : (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <LogoBox text={hospital.name.slice(0, 2).toUpperCase()} color={colors.surfaceAlt} size={52} image={assetSource(hospital.logoAsset)} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.name}>{hospital.name}</Text>
              <Text style={styles.tags}>
                {hospital.specialty.split(" ")[0]} | {hospital.country === "USA" ? "United States" : hospital.country}
              </Text>
            </View>
          </View>

          <PlaceBadges name={hospital.name} location={hospital.country} rating={hospital.rating} />

          <Text style={styles.sectionTitle}>About us</Text>
          <ExpandableText text={hospital.about} style={styles.about} />

          <View style={{ marginTop: 14 }}>
            <InfoRow label="Care system" value={hospital.careSystem} />
            <InfoRow
              label="Open Hours"
              value={hospital.openHours}
              valueColor={colors.success}
              subValue={hospital.openHoursNote ?? undefined}
            />
            <InfoRow label="Helipad:" value={hospital.helipadCode ?? "—"} />
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Specialists</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: 12 }}
        >
          {hospital.specialists.map((sp) => (
            <SpecialistCard key={sp.id} specialist={sp} onPress={() => setSelectedId(sp.id)} />
          ))}
        </ScrollView>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          <View style={{ marginTop: 10 }}>
            <ReviewsList targetType="hospital" targetId={hospital.id} />
          </View>
        </View>

        <Button
          label="Book Appointment"
          disabled={!hospital.bookable}
          onPress={() => navigation.navigate("BookAppointment", { hospitalId: hospital.id })}
          style={styles.cta}
        />
      </ScrollView>
      )}

      <BottomSheet visible={!!selectedId} onClose={() => setSelectedId(null)}>
        {selectedSpecialist && (
          <View style={{ paddingBottom: 10 }}>
            <View style={styles.specHeader}>
              <Image source={assetSource(selectedSpecialist.photoAsset, images.doctor1)} style={styles.specPhoto} />
              <View style={{ marginLeft: 14 }}>
                <Text style={styles.specName}>{selectedSpecialist.name}</Text>
                <Text style={styles.specAvailable}>
                  {selectedSpecialist.available ? "Available" : "Unavailable"}
                </Text>
              </View>
            </View>
            {selectedSpecialist.certified ? (
              <View style={styles.chipRow}>
                <Chip
                  label="Certified"
                  elevated
                  icon={<MaterialCommunityIcons name="shield-check" size={16} color={colors.success} />}
                />
              </View>
            ) : null}
            <View style={{ marginTop: 8 }}>
              <InfoRow
                label="Specialization:"
                value={selectedSpecialist.specialization ?? "—"}
                subValue={selectedSpecialist.experience ?? undefined}
              />
              <InfoRow
                label="Operation Country:"
                value={selectedSpecialist.operationCountry ?? "—"}
                subValue={selectedSpecialist.operationCountryNote ?? undefined}
              />
              <InfoRow label="Language Spoken:" value={selectedSpecialist.languages ?? "—"} />
            </View>
            <Text style={styles.expertiseTitle}>Key Areas of Expertise:</Text>
            {selectedSpecialist.expertise.map((e) => (
              <View key={e} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{e}</Text>
              </View>
            ))}
          </View>
        )}
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg },
  titleRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  name: { fontSize: 17.5, fontWeight: "700", color: colors.text },
  tags: { fontSize: 12.5, fontWeight: "500", color: colors.primary, marginTop: 4 },
  chipRow: { flexDirection: "row", alignItems: "center", marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 22 },
  about: { fontSize: 13.5, color: colors.text, lineHeight: 20, marginTop: 8 },
  readMore: { fontSize: 13.5, color: colors.primary, fontWeight: "600", marginTop: 2 },
  cta: { marginHorizontal: spacing.xxl, marginTop: 30, borderRadius: 24 },
  specHeader: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  specPhoto: { width: 56, height: 56, borderRadius: 8 },
  specName: { fontSize: 17, fontWeight: "700", color: colors.text },
  specAvailable: { fontSize: 12.5, fontWeight: "600", color: colors.success, marginTop: 3 },
  expertiseTitle: { fontSize: 13.5, fontWeight: "700", color: colors.text, marginTop: 14 },
  bulletRow: { flexDirection: "row", marginTop: 7, paddingRight: 8 },
  bullet: { fontSize: 13, color: colors.secondaryText, marginRight: 8, lineHeight: 18 },
  bulletText: { flex: 1, fontSize: 12.5, color: colors.secondaryText, lineHeight: 18 },
});
