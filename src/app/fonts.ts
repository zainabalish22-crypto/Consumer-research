import { IBM_Plex_Sans_Arabic, JetBrains_Mono, Manrope, Noto_Kufi_Arabic, Sora } from "next/font/google";

/** Sora (display), Manrope (reading and interface), JetBrains Mono (labels and data), Noto Kufi Arabic and IBM Plex Sans Arabic. */
const sora = Sora({ subsets: ["latin"], weight: ["300", "400", "600"], variable: "--font-sora", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-manrope", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });
const kufi = Noto_Kufi_Arabic({ subsets: ["arabic"], weight: ["300", "400", "600"], variable: "--font-kufi", display: "swap" });
const plexAr = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600"], variable: "--font-plex-ar", display: "swap" });

export const fontVars = [sora, manrope, jetbrains, kufi, plexAr].map((f) => f.variable).join(" ");
