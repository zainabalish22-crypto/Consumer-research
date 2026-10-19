import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadExportData } from "@/lib/export/load";
import { buildColumns } from "@/lib/export/columns";
import { codebookCsv, wideCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  if (!z.string().uuid().safeParse(studyId).success) return new NextResponse("Not found", { status: 404 });
  const kind = request.nextUrl.searchParams.get("kind") ?? "wide";
  if (!["wide", "codebook", "config"].includes(kind)) return new NextResponse("Bad request", { status: 400 });
  const includeTest = request.nextUrl.searchParams.get("test") === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: study } = await supabase.from("studies").select("id, title, slug, projects(workspace_id)").eq("id", studyId).maybeSingle();
  if (!study) return new NextResponse("Not found", { status: 404 });

  const data = await loadExportData(supabase, studyId, includeTest);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${study.slug}_${stamp}`;

  const ws = (study.projects as unknown as { workspace_id: string } | null)?.workspace_id;
  if (ws) {
    await supabase.from("audit_logs").insert({
      workspace_id: ws,
      actor_id: user.id,
      action: "data.exported",
      entity_type: "study",
      entity_id: studyId,
      details: { kind, include_test: includeTest, rows: data.sessions.length },
    });
  }

  let body: string;
  let filename: string;
  let type = "text/csv; charset=utf-8";
  if (kind === "config") {
    body = JSON.stringify(
      {
        study: { id: study.id, title: study.title },
        exported_at: new Date().toISOString(),
        versions: data.versions.map((v) => ({
          version_number: v.version_number,
          published_at: v.published_at,
          locked: v.locked,
          config: v.config,
        })),
      },
      null,
      2,
    );
    filename = `${base}_config.json`;
    type = "application/json; charset=utf-8";
  } else {
    const columns = buildColumns(data.versions.map((v) => v.config));
    if (kind === "wide") {
      body = wideCsv(columns, data.sessions);
      filename = `${base}${includeTest ? "_with_test" : ""}_data.csv`;
    } else {
      body = codebookCsv(columns);
      filename = `${base}_codebook.csv`;
    }
  }

  return new NextResponse(body, {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
