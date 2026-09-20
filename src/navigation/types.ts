import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  SignIn: undefined;
  Password: { email: string };
  SignUpEmail: undefined;
  AboutYou: { email: string };
  VerifyEmail: undefined;
  SetupChecklist: undefined;
  CreatePassword: undefined;
  MedicalHistory: undefined;
  UploadRecords: undefined;
  MainTabs: undefined;
  Hospitals: undefined;
  HospitalDetail: { hospitalId: string };
  Services: undefined;
  SpecialistTreatments: undefined;
  MedicalTransport: undefined;
  TransportDetail: { providerId: string };
  PetSpecialist: undefined;
  MedicalPackages: undefined;
  PackageDetail: { packageId: string };
  BookAppointment: { hospitalId: string; packageId?: string };
  TravelBooking: { providerId: string };
  BookingSuccess:
    | {
        reference?: string;
        kind?: "appointment" | "transport" | "pet" | "specialist";
        /** Where "View details" goes, so the member is never left at a dead end. */
        detail?: { route: "AppointmentDetail"; appointmentId: string } | { route: "ServiceRequestDetail"; requestId: string };
        headline?: string;
        message?: string;
      }
    | undefined;
  DiagnosisResult: { sessionId: string };
  MealCamera: undefined;
  MealAnalyzing: { imageUri: string; mimeType: string };
  MealReport: { mealId: string };
  Upgrade: undefined;
  AppointmentDetail: { appointmentId: string; notice?: string };
  RescheduleAppointment: { appointmentId: string };
  Profile: undefined;
  EditProfile: undefined;
  EmergencyContact: undefined;
  ChangePassword: undefined;
  Notifications: undefined;
  ComingSoon: { title: string; description: string };
  PetClinicDetail: { clinicId: string };
  PetRequest: { clinicId: string; kind: "appointment" | "sitting"; serviceId?: string };
  Specialists: { categoryId?: string; title?: string } | undefined;
  SpecialistProfile: { specialistId: string };
  SpecialistRequest: { specialistId: string; kind: "booking" | "connect"; serviceId?: string };
  ServiceRequestDetail: { requestId: string; notice?: string };
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

/** For screens reached via useNavigation() rather than as a typed stack screen. */
export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
