import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { ALLOWED_TYPES, blobConfigured, MAX_UPLOAD_BYTES } from "@/lib/server/media";
import { fail, ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Which upload path the browser should use: Vercel Blob, or the local development folder. */
export async function GET() {
  return ok({ mode: blobConfigured() ? "blob" : "local" });
}

/**
 * Issues a short-lived upload permission to a signed-in researcher, so the browser can send the
 * file straight to storage (large videos never pass through this server).
 */
export async function POST(request: Request) {
  if (!blobConfigured()) return fail("notConfigured", 503);
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = await currentUser();
        if (!user) throw new Error("signIn");
        return { allowedContentTypes: ALLOWED_TYPES, maximumSizeInBytes: MAX_UPLOAD_BYTES, addRandomSuffix: true, tokenPayload: user.id };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return fail(e instanceof Error && e.message === "signIn" ? "signIn" : "uploadRefused", 400);
  }
}
