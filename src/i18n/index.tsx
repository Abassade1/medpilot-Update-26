import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, I18nManager } from "react-native";
import * as SecureStore from "expo-secure-store";
import { fr } from "./fr";
import { ar } from "./ar";

export type Language = "en" | "fr" | "ar";
export const LANGUAGES: { code: Language; native: string }[] = [
  { code: "en", native: "English" },
  { code: "fr", native: "Français" },
  { code: "ar", native: "العربية" },
];

const KEY = "medpilot.language";
const DICTIONARIES: Record<Language, Record<string, string>> = { en: {}, fr, ar };

let current: Language = "en";

/**
 * English text is the key, so the app reads naturally and any string without a translation simply
 * stays English. `{name}` placeholders are filled from `vars`.
 */
export function translate(lang: Language, text: string, vars?: Record<string, string | number>): string {
  const out = DICTIONARIES[lang][text] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : out;
}

/** For code outside React components (error messages, alerts built in utilities). */
export const t = (text: string, vars?: Record<string, string | number>) => translate(current, text, vars);
/** Mirrors directional icons (chevrons, arrows) when the layout is right-to-left. */
export const rtlFlip = () => ({ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] });

export const currentLanguage = () => current;
/** The BCP-47 tag used for date and number formatting. */
export const localeTag = (lang: Language = current) => ({ en: "en-GB", fr: "fr-FR", ar: "ar" })[lang];

interface Ctx {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (text: string, vars?: Record<string, string | number>) => string;
}
const LanguageContext = createContext<Ctx>({ language: "en", setLanguage: async () => {}, t: (s, v) => translate("en", s, v) });

/** Right-to-left needs the layout direction set natively, which only takes effect on the next launch. */
function applyDirection(lang: Language): boolean {
  const wantRTL = lang === "ar";
  I18nManager.allowRTL(wantRTL);
  I18nManager.forceRTL(wantRTL);
  return I18nManager.isRTL !== wantRTL;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((v) => {
        if (v === "en" || v === "fr" || v === "ar") { current = v; setLang(v); }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    current = lang;
    setLang(lang);
    await SecureStore.setItemAsync(KEY, lang).catch(() => {});
    if (applyDirection(lang)) {
      Alert.alert(
        translate(lang, "Restart to finish"),
        translate(lang, "Close and reopen MedPilot to switch the screen layout direction."),
      );
    }
  }, []);

  const value = useMemo<Ctx>(() => ({ language, setLanguage, t: (s, v) => translate(language, s, v) }), [language, setLanguage]);
  // Hold the first render until the saved language is known, so the app never flashes in English.
  return <LanguageContext.Provider value={value}>{ready ? children : null}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
/** `const t = useT();` then `t("Cancel appointment")`. Re-renders the screen when the language changes. */
export const useT = () => useContext(LanguageContext).t;
