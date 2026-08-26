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
  BookingSuccess: { reference?: string; kind?: "appointment" | "transport" } | undefined;
  DiagnosisResult: { sessionId: string };
  MealCamera: undefined;
  MealAnalyzing: { imageUri: string; mimeType: string };
  MealReport: { mealId: string };
  Upgrade: undefined;
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
