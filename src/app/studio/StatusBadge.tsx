import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import type { StudyStatus } from "@/lib/data";

const tone = { draft: "neutral", active: "ok", paused: "warn", closed: "danger" } as const;

export function StatusBadge({ status }: { status: StudyStatus }) {
  const t = useTranslations("studio.dashboard.status");
  return <Badge tone={tone[status]}>{t(status)}</Badge>;
}
