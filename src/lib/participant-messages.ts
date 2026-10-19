import "server-only";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import type { ParticipantMessages } from "@/components/participant/i18n";

export const participantMessages: Record<"en" | "ar", ParticipantMessages> = {
  en: en.participant,
  ar: ar.participant,
};
