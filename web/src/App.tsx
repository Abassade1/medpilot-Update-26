import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Login from "./routes/Login";
import Layout from "./routes/Layout";
import Overview from "./routes/Overview";
import Profile from "./routes/Profile";
import Listings from "./routes/Listings";
import ListingForm from "./routes/ListingForm";
import ListingPreview from "./routes/ListingPreview";
import Availability from "./routes/Availability";
import Bookings from "./routes/Bookings";
import BookingDetail from "./routes/BookingDetail";
import Notifications from "./routes/Notifications";
import Settings from "./routes/Settings";

function Protected({ children }: { children: React.ReactNode }) {
  const { signedIn } = useAuth();
  return signedIn ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { signedIn } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={signedIn ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Overview />} />
        <Route path="profile" element={<Profile />} />
        <Route path="services" element={<Listings kind="service" />} />
        <Route path="services/new" element={<ListingForm kind="service" />} />
        <Route path="services/:id" element={<ListingForm kind="service" />} />
        <Route path="packages" element={<Listings kind="package" />} />
        <Route path="packages/new" element={<ListingForm kind="package" />} />
        <Route path="packages/:id" element={<ListingForm kind="package" />} />
        <Route path="listing/:id/preview" element={<ListingPreview />} />
        <Route path="listing/:id/availability" element={<Availability />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
