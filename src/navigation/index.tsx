import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";
import MainTabs from "./MainTabs";
import SplashScreen from "../screens/auth/SplashScreen";
import OnboardingScreen from "../screens/auth/OnboardingScreen";
import SignInScreen from "../screens/auth/SignInScreen";
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
import DiagnosisResultScreen from "../screens/aux/DiagnosisResultScreen";
import MealCameraScreen from "../screens/aux/MealCameraScreen";
import MealAnalyzingScreen from "../screens/aux/MealAnalyzingScreen";
import MealReportScreen from "../screens/aux/MealReportScreen";
import UpgradeScreen from "../screens/aux/UpgradeScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

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
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="Password" component={PasswordScreen} />
        <Stack.Screen name="SignUpEmail" component={SignUpEmailScreen} />
        <Stack.Screen name="AboutYou" component={AboutYouScreen} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <Stack.Screen name="SetupChecklist" component={SetupChecklistScreen} />
        <Stack.Screen name="CreatePassword" component={CreatePasswordScreen} />
        <Stack.Screen name="MedicalHistory" component={MedicalHistoryScreen} />
        <Stack.Screen name="UploadRecords" component={UploadRecordsScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
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
        <Stack.Screen name="DiagnosisResult" component={DiagnosisResultScreen} />
        <Stack.Screen name="MealCamera" component={MealCameraScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="MealAnalyzing" component={MealAnalyzingScreen} />
        <Stack.Screen name="MealReport" component={MealReportScreen} />
        <Stack.Screen name="Upgrade" component={UpgradeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
