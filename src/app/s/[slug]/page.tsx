import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StudyConfig } from "@/lib/study/schema";
import { StudyRunner } from "@/components/participant/StudyRunner";
import { participantMessages } from "@/lib/participant-messages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const RESERVED = new Set(["test"]);

function Notice({ en, ar }: { en: string; ar: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4 text-center">
      <p lang="en" dir="ltr" className="text-lg">
        {en}
      </p>
      <p lang="ar" dir="rtl" className="text-lg">
        {ar}
      </p>
    </main>
  );
}

export default async function ParticipantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const m = participantMessages;
  if (!/^[a-z0-9]{8,32}$/.test(slug)) return <Notice en={m.en.notFound} ar={m.ar.notFound} />;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_study", { p_slug: slug });
  const s = data as { found: boolean; status?: string; available?: boolean; can_test?: boolean; config?: unknown } | null;
  if (error || !s?.found) return <Notice en={m.en.notFound} ar={m.ar.notFound} />;
  if (!s.available) {
    const key = s.status === "paused" ? "paused" : "closed";
    return <Notice en={m.en[key]} ar={m.ar[key]} />;
  }

  const wantsTest = sp.test === "1";
  if (wantsTest && !s.can_test) return <Notice en={m.en.testForbidden} ar={m.ar.testForbidden} />;
  if (!wantsTest && s.status !== "active") {
    return <Notice en={m.en[s.status === "paused" ? "paused" : "closed"]} ar={m.ar[s.status === "paused" ? "paused" : "closed"]} />;
  }

  const parsed = StudyConfig.safeParse(s.config);
  if (!parsed.success) return <Notice en={m.en.apiError_configInvalid} ar={m.ar.apiError_configInvalid} />;

  // Recruitment parameters (e.g. a panel participant ID) are passed through into the data.
  const recruitment: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (RESERVED.has(k) || typeof v !== "string") continue;
    if (/^[A-Za-z0-9_]{1,64}$/.test(k)) recruitment[k] = v.slice(0, 200);
  }

  return (
    <StudyRunner
      mode={wantsTest ? "test" : "live"}
      slug={slug}
      config={parsed.data}
      messages={participantMessages}
      params={recruitment}
    />
  );
}
