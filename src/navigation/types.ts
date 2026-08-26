import type { NativeStackScreenProps } from "@react-navigation/native-stack";

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
  BookAppointment: { hospitalId?: string };
  TravelBooking: { providerId?: string };
  BookingSuccess: undefined;
  DiagnosisResult: undefined;
  MealCamera: undefined;
  MealAnalyzing: undefined;
  MealReport: undefined;
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
