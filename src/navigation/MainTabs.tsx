import React from "react";
import { Image, ImageSourcePropType } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/home/HomeScreen";
import ActivitiesScreen from "../screens/activities/ActivitiesScreen";
import AuxChatScreen from "../screens/aux/AuxChatScreen";
import AppointmentsScreen from "../screens/appointments/AppointmentsScreen";
import { images } from "../data/mock";
import { colors } from "../theme";

function TabIcon({ source, color }: { source: ImageSourcePropType; color: string }) {
  return (
    <Image
      source={source}
      style={{ width: 22, height: 22, tintColor: color }}
      resizeMode="contain"
    />
  );
}

export type MainTabsParamList = {
  HomeTab: undefined;
  ActivitiesTab: undefined;
  AuxTab: undefined;
  AppointmentsTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondaryText,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "500" },
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.borderLight,
          backgroundColor: "#fff",
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon source={images.tabHome} color={color} />,
        }}
      />
      <Tab.Screen
        name="ActivitiesTab"
        component={ActivitiesScreen}
        options={{
          title: "Activities",
          tabBarIcon: ({ color }) => <TabIcon source={images.tabActivities} color={color} />,
        }}
      />
      <Tab.Screen
        name="AuxTab"
        component={AuxChatScreen}
        options={{
          title: "AUX",
          tabBarIcon: ({ color }) => <TabIcon source={images.tabAux} color={color} />,
        }}
      />
      <Tab.Screen
        name="AppointmentsTab"
        component={AppointmentsScreen}
        options={{
          title: "Appointments",
          tabBarIcon: ({ color }) => <TabIcon source={images.tabAppointments} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
