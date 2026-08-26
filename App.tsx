import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RootNavigator from "./src/navigation";
import { SessionProvider } from "./src/state/Session";
import { ApiError } from "./src/api/errors";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // never retry a rejection the server already decided on
        if (error instanceof ApiError && !error.isOffline) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    // mutations carry idempotency keys, but auto-retry stays off by default
    mutations: { retry: false },
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
