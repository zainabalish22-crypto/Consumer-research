import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadEvents, loadExportData } from "@/lib/export/load";
import { buildColumns } from "@/lib/export/columns";
import { codebookCsv, eventLogCsv, wideCsv } from "@/lib/export/csv";
import { spssSyntax } from "@/lib/export/spss";

export const dynamic = "force-dynamic";

const KINDS = ["wide", "codebook", "config", "events", "spss"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  if (!z.string().uuid().safeParse(studyId).success) return new NextResponse("Not found", { status: 404 });
  const kind = (request.nextUrl.searchParams.get("kind") ?? "wide") as (typeof KINDS)[number];
  if (!KINDS.includes(kind)) return new NextResponse("Bad request", { status: 400 });
  const includeTest = request.nextUrl.searchParams.get("test") === "1";
  const lang = request.nextUrl.searchParams.get("lang") === "ar" ? "ar" : "en";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: study } = await supabase.from("studies").select("id, title, slug, projects(workspace_id)").eq("id", studyId).maybeSingle();
  if (!study) return new NextResponse("Not found", { status: 404 });

  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${study.slug}_${stamp}`;
  const dataFile = `${base}${includeTest ? "_with_test" : ""}_data.csv`;

  let body: string;
  let filename: string;
  let rows = 0;
  let type = "text/csv; charset=utf-8";

  if (kind === "events") {
    const events = await loadEvents(supabase, studyId, includeTest);
    rows = events.length;
    body = eventLogCsv(events);
    filename = `${base}${includeTest ? "_with_test" : ""}_events.csv`;
  } else {
    const data = await loadExportData(supabase, studyId, includeTest);
    rows = data.sessions.length;
    const columns = buildColumns(
      data.versions.map((v) => v.config),
      data.extras,
    );
    if (kind === "config") {
      body = JSON.stringify(
        {
          study: { id: study.id, title: study.title },
          exported_at: new Date().toISOString(),
          versions: data.versions.map((v) => ({ version_number: v.version_number, published_at: v.published_at, locked: v.locked, config: v.config })),
        },
        null,
        2,
      );
      filename = `${base}_config.json`;
      type = "application/json; charset=utf-8";
    } else if (kind === "wide") {
      body = wideCsv(columns, data.sessions);
      filename = dataFile;
    } else if (kind === "codebook") {
      body = codebookCsv(columns);
      filename = `${base}_codebook.csv`;
    } else {
      body = spssSyntax(columns, dataFile, lang);
      filename = `${base}${includeTest ? "_with_test" : ""}_labels_${lang}.sps`;
      type = "text/plain; charset=utf-8";
    }
  }

  const ws = (study.projects as unknown as { workspace_id: string } | null)?.workspace_id;
  if (ws) {
    await supabase.from("audit_logs").insert({
      workspace_id: ws,
      actor_id: user.id,
      action: "data.exported",
      entity_type: "study",
      entity_id: studyId,
      details: { kind, include_test: includeTest, rows },
    });
  }

  return new NextResponse(body, {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
