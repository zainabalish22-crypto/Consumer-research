import { toCsv } from "@/lib/tools/csv";

/**
 * A small invented dataset for trying the tool: opinions about a fictional café chain, in
 * English and Gulf Arabic, labelled by two coders who sometimes disagree. The accounts are
 * made up. One label is misspelt on purpose, to show how unrecognised values are handled.
 */
const ROWS: [string, string, string, string, string, string, string, string][] = [
  ["The new cold brew is excellent, will order again", "positive", "positive", "user_noor", "Product", "en", "", "2026-03-02"],
  ["Waited 25 minutes for one latte. Not acceptable.", "negative", "negative", "user_sam", "Service", "en", "", "2026-03-02"],
  ["They open at 7 on weekdays", "neutral", "neutral", "user_lina", "Service", "en", "", "2026-03-03"],
  ["القهوة وايد حلوة والمكان رايق", "إيجابي", "إيجابي", "user_fahad", "Product", "ar", "Bahrain", "2026-03-03"],
  ["الخدمة بطيئة مرة والموظف ما رد علينا", "سلبي", "سلبي", "user_reem", "Service", "ar", "Saudi Arabia", "2026-03-04"],
  ["الفرع الجديد في المجمع", "محايد", "محايد", "user_fahad", "Service", "ar", "Bahrain", "2026-03-04"],
  ["Prices went up again but the quality is still good", "positive", "neutral", "user_noor", "Price", "en", "", "2026-03-05"],
  ["السعر غالي بس يستاهل", "إيجابي", "محايد", "user_mariam", "Price", "ar", "Kuwait", "2026-03-05"],
  ["Loyalty app keeps crashing", "negative", "negative", "user_sam", "App", "en", "", "2026-03-06"],
  ["التطبيق يعلق كل ما أطلب", "سلبي", "سلبي", "user_reem", "App", "ar", "Saudi Arabia", "2026-03-06"],
  ["Great, another price increase. Just what we needed.", "negative", "positive", "user_omar", "Price", "en", "", "2026-03-07"],
  ["Staff were friendly and remembered my order", "positive", "positive", "user_lina", "Service", "en", "", "2026-03-07"],
  ["الموظفين محترمين والطلب وصل سريع", "إيجابي", "إيجابي", "user_mariam", "Service", "ar", "Kuwait", "2026-03-08"],
  ["Is the seasonal menu back yet?", "neutral", "neutral", "user_omar", "Product", "en", "", "2026-03-08"],
  ["الحلا عندهم عادي ما فيه شي مميز", "محايد", "سلبي", "user_khalid", "Product", "ar", "UAE", "2026-03-09"],
  ["The iced latte tasted burnt today", "negative", "negative", "user_noor", "Product", "en", "", "2026-03-09"],
  ["أحسن كوفي بالمنطقة بدون منافس", "إيجابي", "إيجابي", "user_khalid", "Product", "ar", "UAE", "2026-03-10"],
  ["Parking is limited at the downtown branch", "neutral", "negative", "user_sam", "Service", "en", "", "2026-03-10"],
  ["عروض الأسبوع هذا حلوة", "ايجابى", "إيجابي", "user_fahad", "Price", "ar", "Bahrain", "2026-03-11"],
  ["The app update fixed the payment problem, thank you", "positive", "positive", "user_lina", "App", "en", "", "2026-03-11"],
  ["طلبت مرتين وكل مرة الطلب غلط", "سلبي", "سلبي", "user_reem", "Service", "ar", "Saudi Arabia", "2026-03-12"],
  ["Mixed feelings about the new cups", "mixed", "neutral", "user_omar", "Product", "en", "", "2026-03-12"],
  ["الأسعار نفس باقي المحلات", "محايد", "محايد", "user_mariam", "Price", "ar", "Kuwait", "2026-03-13"],
  ["Best breakfast deal in town", "positive", "positive", "user_noor", "Price", "en", "", "2026-03-13"],
];

const HEADER = ["text", "sentiment", "coder2_sentiment", "account", "category", "language", "country", "date"];

export const sampleCsv = () => toCsv([HEADER, ...ROWS]);
export const templateCsv = () => toCsv([HEADER]);
