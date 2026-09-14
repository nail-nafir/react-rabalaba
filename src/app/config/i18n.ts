import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/assets/locales/en.json";
import id from "@/assets/locales/id.json";

const resources = {
  en: { translation: en },
  id: { translation: id },
};

const storedLang =
  typeof window !== "undefined"
    ? localStorage.getItem("i18nextLng") || "id"
    : "id";

function syncDocumentLanguage() {
  if (typeof document !== "undefined") {
    document.documentElement.lang = i18n.resolvedLanguage || "id";
  }
}

i18n.on("languageChanged", syncDocumentLanguage);
i18n.on("initialized", syncDocumentLanguage);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: storedLang,
    fallbackLng: "id",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
