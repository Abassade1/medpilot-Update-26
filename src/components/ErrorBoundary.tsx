import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Button from "./Button";
import { colors, spacing } from "../theme";

interface State { failed: boolean }

/** Last line of defence: a render error shows a way back instead of a blank or frozen screen. */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  // Deliberately no logging of props/state: screens can hold health information.
  componentDidCatch(error: Error) {
    if (__DEV__) console.warn("Unhandled render error:", error.message);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.text}>The app hit an unexpected problem. Your data is safe. Try again to pick up where you left off.</Text>
        <Button label="Try again" variant="pill" onPress={() => this.setState({ failed: false })} style={{ marginTop: 20 }} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  text: { fontSize: 14, color: colors.secondaryText, textAlign: "center", lineHeight: 20, marginTop: 8 },
});
