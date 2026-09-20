import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { ensurePermission } from "../utils/permissions";

const MIC_REASON = "MedPilot uses the microphone so you can speak to the AUX assistant.";

/**
 * Voice capture for the assistant input bars. Owns the microphone permission
 * (requested at point of use), the recording lifecycle and error handling.
 * Transcription is out of scope until the backend exists — `onCaptured`
 * receives the local recording URI.
 */
export function useVoiceInput(onCaptured?: (uri: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      // useAudioRecorder disposes the native recorder on unmount, so touching
      // it here (even to stop a dangling capture) reaches a freed shared object
      // and throws. Only the mounted flag is ours to clean up.
      mounted.current = false;
    };
  }, []);

  const start = useCallback(async () => {
    const ok = await ensurePermission({
      label: "Microphone",
      reason: MIC_REASON,
      status: await AudioModule.getRecordingPermissionsAsync(),
      request: AudioModule.requestRecordingPermissionsAsync,
    });
    if (!ok) return;

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      if (mounted.current) setRecording(true);
    } catch {
      Alert.alert("Microphone unavailable", "Recording isn't available on this device.");
    }
  }, [recorder]);

  const stop = useCallback(async () => {
    try {
      await recorder.stop();
      if (recorder.uri) onCaptured?.(recorder.uri);
    } catch {
      Alert.alert("Recording failed", "We couldn't save that recording. Please try again.");
    } finally {
      if (mounted.current) setRecording(false);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  }, [recorder, onCaptured]);

  /** Single entry point for the mic button; guards double-taps. */
  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (recording) await stop();
      else await start();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, recording, start, stop]);

  return { recording, busy, toggle };
}
