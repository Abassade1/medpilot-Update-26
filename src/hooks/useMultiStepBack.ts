import { useEffect } from "react";
import { useNavigation } from "@react-navigation/native";

/**
 * Keeps multi-step forms consistent with the platform back affordances.
 * Intercepts the header back button, the iOS swipe-back gesture and the
 * Android hardware back button so they step backwards through the form
 * instead of discarding the whole flow.
 */
export function useMultiStepBack(step: number, goBackStep: () => void) {
  const navigation = useNavigation();

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e: any) => {
      if (step <= 1) return; // first step: let the screen pop normally
      // Only back gestures step backwards. A programmatic replace/reset/navigate (e.g. to the
      // success screen after submitting) must be allowed to remove this screen, or a completed
      // booking would bounce the member back a step.
      const type: string | undefined = e?.data?.action?.type;
      if (type && type !== "GO_BACK" && type !== "POP") return;
      e.preventDefault();
      goBackStep();
    });
    return unsub;
  }, [navigation, step, goBackStep]);
}
