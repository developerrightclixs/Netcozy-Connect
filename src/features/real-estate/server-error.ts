import { NextResponse } from "next/server";
import { z } from "zod";
import { ServiceError } from "@/lib/supabase/server";
export function failure(e: unknown) {
  return NextResponse.json(
    {
      error:
        e instanceof ServiceError
          ? e.message
          : e instanceof z.ZodError
            ? "Check " +
              e.issues
                .map((i) => i.path.join(".") + ": " + i.message)
                .join("; ")
            : "The request could not be completed. Please try again.",
    },
    {
      status:
        e instanceof ServiceError
          ? e.status
          : e instanceof z.ZodError
            ? 400
            : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
