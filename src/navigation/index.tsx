import React, { useEffect, useRef } from "react";
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from "@react-navigation/native";
import { useSession } from "../state/Session";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";
import MainTabs from "./MainTabs";
import SplashScreen from "../screens/auth/SplashScreen";
import OnboardingScreen from "../screens/auth/OnboardingScreen";
import SignInScreen from "../screens/auth/SignInScreen";
import ResetPasswordScreen from "../screens/auth/ResetPasswordScreen";
import PasswordScreen from "../screens/auth/PasswordScreen";
import SignUpEmailScreen from "../screens/auth/SignUpEmailScreen";
import AboutYouScreen from "../screens/auth/AboutYouScreen";
import VerifyEmailScreen from "../screens/auth/VerifyEmailScreen";
import SetupChecklistScreen from "../screens/auth/SetupChecklistScreen";
import CreatePasswordScreen from "../screens/auth/CreatePasswordScreen";
import MedicalHistoryScreen from "../screens/auth/MedicalHistoryScreen";
import UploadRecordsScreen from "../screens/auth/UploadRecordsScreen";
import HospitalsScreen from "../screens/hospitals/HospitalsScreen";
import HospitalDetailScreen from "../screens/hospitals/HospitalDetailScreen";
import ServicesScreen from "../screens/services/ServicesScreen";
import SpecialistTreatmentsScreen from "../screens/services/SpecialistTreatmentsScreen";
import MedicalTransportScreen from "../screens/services/MedicalTransportScreen";
import TransportDetailScreen from "../screens/services/TransportDetailScreen";
import PetSpecialistScreen from "../screens/services/PetSpecialistScreen";
import MedicalPackagesScreen from "../screens/services/MedicalPackagesScreen";
import PackageDetailScreen from "../screens/services/PackageDetailScreen";
import BookAppointmentScreen from "../screens/appointments/BookAppointmentScreen";
import TravelBookingScreen from "../screens/appointments/TravelBookingScreen";
import BookingSuccessScreen from "../screens/appointments/BookingSuccessScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import EditProfileScreen from "../screens/profile/EditProfileScreen";
import EmergencyContactScreen from "../screens/profile/EmergencyContactScreen";
import ChangePasswordScreen from "../screens/profile/ChangePasswordScreen";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";
import ServiceRequestDetailScreen from "../screens/appointments/ServiceRequestDetailScreen";
import ComingSoonScreen from "../screens/services/ComingSoonScreen";
import PetClinicDetailScreen from "../screens/services/PetClinicDetailScreen";
import PetRequestScreen from "../screens/services/PetRequestScreen";
import SpecialistsScreen from "../screens/specialists/SpecialistsScreen";
import SpecialistProfileScreen from "../screens/specialists/SpecialistProfileScreen";
import SpecialistRequestScreen from "../screens/specialists/SpecialistRequestScreen";
import TransportBookingDetailScreen from "../screens/appointments/TransportBookingDetailScreen";
import AppointmentDetailScreen from "../screens/appointments/AppointmentDetailScreen";
import ProviderHomeScreen from "../screens/provider/ProviderHomeScreen";
import ProviderOnboardingScreen from "../screens/provider/ProviderOnboardingScreen";
import ProviderProfileScreen from "../screens/provider/ProviderProfileScreen";
import ProviderListingsScreen from "../screens/provider/ProviderListingsScreen";
import ListingFormScreen from "../screens/provider/ListingFormScreen";
import ListingAvailabilityScreen from "../screens/provider/ListingAvailabilityScreen";
import ProviderBookingsScreen from "../screens/provider/ProviderBookingsScreen";
import ProviderBookingDetailScreen from "../screens/provider/ProviderBookingDetailScreen";
import DiscoverScreen from "../screens/provider/DiscoverScreen";
import ListingDetailScreen from "../screens/provider/ListingDetailScreen";
import ListingBookScreen from "../screens/provider/ListingBookScreen";
import RescheduleAppointmentScreen from "../screens/appointments/RescheduleAppointmentScreen";
import DiagnosisResultScreen from "../screens/aux/DiagnosisResultScreen";
import MealCameraScreen from "../screens/aux/MealCameraScreen";
import MealAnalyzingScreen from "../screens/aux/MealAnalyzingScreen";
import MealReportScreen from "../screens/aux/MealReportScreen";
import UpgradeScreen from "../screens/aux/UpgradeScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// The reset email links to medpilot://reset?token=…; nothing else is opened from a URL.
const linking = {
  prefixes: ["medpilot://"],
  config: { screens: { ResetPassword: "reset" } },
};

/**
 * Sends the member back to sign-in whenever an authenticated session ends: signing out, deleting the
 * account, or a session that could no longer be refreshed. Without this the last screen stays up,
 * showing a spinner for data it can no longer load.
 */
function SessionGuard() {
  const { status } = useSession();
  const wasAuthenticated = useRef(false);
  useEffect(() => {
    if (status === "authenticated") wasAuthenticated.current = true;
    if (status === "anonymous" && wasAuthenticated.current) {
      wasAuthenticated.current = false;
      if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: "SignIn" }] });
    }
  }, [status]);
  return null;
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.primary,
    text: colors.text,
  },
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme} ref={navigationRef} linking={linking}>
      <SessionGuard />
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="Password" component={PasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="SignUpEmail" component={SignUpEmailScreen} />
        <Stack.Screen name="AboutYou" component={AboutYouScreen} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <Stack.Screen name="SetupChecklist" component={SetupChecklistScreen} />
        <Stack.Screen name="CreatePassword" component={CreatePasswordScreen} />
        <Stack.Screen name="MedicalHistory" component={MedicalHistoryScreen} />
        <Stack.Screen name="UploadRecords" component={UploadRecordsScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Hospitals" component={HospitalsScreen} />
        <Stack.Screen name="HospitalDetail" component={HospitalDetailScreen} />
        <Stack.Screen name="Services" component={ServicesScreen} />
        <Stack.Screen name="SpecialistTreatments" component={SpecialistTreatmentsScreen} />
        <Stack.Screen name="MedicalTransport" component={MedicalTransportScreen} />
        <Stack.Screen name="TransportDetail" component={TransportDetailScreen} />
        <Stack.Screen name="PetSpecialist" component={PetSpecialistScreen} />
        <Stack.Screen name="MedicalPackages" component={MedicalPackagesScreen} />
        <Stack.Screen name="PackageDetail" component={PackageDetailScreen} />
        <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} />
        <Stack.Screen name="TravelBooking" component={TravelBookingScreen} />
        <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="EmergencyContact" component={EmergencyContactScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="ServiceRequestDetail" component={ServiceRequestDetailScreen} />
        <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
        <Stack.Screen name="PetClinicDetail" component={PetClinicDetailScreen} />
        <Stack.Screen name="PetRequest" component={PetRequestScreen} />
        <Stack.Screen name="Specialists" component={SpecialistsScreen} />
        <Stack.Screen name="SpecialistProfile" component={SpecialistProfileScreen} />
        <Stack.Screen name="SpecialistRequest" component={SpecialistRequestScreen} />
        <Stack.Screen name="TransportBookingDetail" component={TransportBookingDetailScreen} />
        <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
        <Stack.Screen name="ProviderHome" component={ProviderHomeScreen} />
        <Stack.Screen name="ProviderOnboarding" component={ProviderOnboardingScreen} />
        <Stack.Screen name="ProviderProfile" component={ProviderProfileScreen} />
        <Stack.Screen name="ProviderListings" component={ProviderListingsScreen} />
        <Stack.Screen name="ListingForm" component={ListingFormScreen} />
        <Stack.Screen name="ListingAvailability" component={ListingAvailabilityScreen} />
        <Stack.Screen name="ProviderBookings" component={ProviderBookingsScreen} />
        <Stack.Screen name="ProviderBookingDetail" component={ProviderBookingDetailScreen} />
        <Stack.Screen name="Discover" component={DiscoverScreen} />
        <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
        <Stack.Screen name="ListingBook" component={ListingBookScreen} />
        <Stack.Screen name="RescheduleAppointment" component={RescheduleAppointmentScreen} />
        <Stack.Screen name="DiagnosisResult" component={DiagnosisResultScreen} />
        <Stack.Screen name="MealCamera" component={MealCameraScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="MealAnalyzing" component={MealAnalyzingScreen} />
        <Stack.Screen name="MealReport" component={MealReportScreen} />
        <Stack.Screen name="Upgrade" component={UpgradeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
