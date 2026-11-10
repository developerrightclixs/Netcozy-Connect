import { failure } from "@/features/real-estate/server-error";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  session,
  setSession,
  sameOrigin,
  ServiceError,
  type Session,
} from "@/lib/supabase/server";
import { latestConsent, isAdmin } from "@/features/core/domain";
import * as v from "@/features/real-estate/domain";
import { validateCsv } from "@/features/real-estate/import";
import {
  demoPartnerDelivery,
  livePartnerDelivery,
} from "@/integrations/partner-delivery/provider";
import { propertyFeed } from "@/integrations/property-data/provider";
const eq = (id: string) => "id=eq." + encodeURIComponent(id);
const owner = (s: Session) => "owner_id=eq." + s.user.id;
async function assigned(s: Session) {
  return (
    await s.client.table<{ role: string }>("roles", "user_id=eq." + s.user.id)
  ).map((r) => r.role);
}
async function owned<T>(s: Session, table: string, id: string) {
  const rows = await s.client.table<T>(table, eq(id) + "&" + owner(s));
  if (!rows[0]) throw new ServiceError(404, "Owned record not found.");
  return rows[0];
}
async function bootstrap(s: Session, request: NextRequest) {
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .parse(request.nextUrl.searchParams.get("page") ?? 0);
  const selected = z
    .string()
    .uuid()
    .optional()
    .parse(request.nextUrl.searchParams.get("property") ?? undefined);
  const roles = await assigned(s),
    q = owner(s),
    c = s.client;
  const selectedImport = z
    .string()
    .uuid()
    .optional()
    .parse(request.nextUrl.searchParams.get("import") ?? undefined);
  const search = z
    .string()
    .trim()
    .max(100)
    .parse(request.nextUrl.searchParams.get("q") ?? "");
  const filter = search
    ? "&address=ilike." +
      encodeURIComponent("%" + search.replace(/[\\%_*]/g, "\\$&") + "%")
    : "";
  const properties = await c.table<v.Property>(
    "properties",
    q + filter + "&order=updated_at.desc,id.asc&limit=21&offset=" + page * 20,
  );
  const related = selected
    ? "property_id=eq." + selected
    : "property_id=is.null";
  const [
    claims,
    evidence,
    contacts,
    permissions,
    outreach,
    developers,
    templates,
    forms,
    reviews,
    deliveries,
    imports,
    consents,
  ] = await Promise.all([
    c.table<v.Claim>("property_claims", related),
    c.table<v.Evidence>(
      "property_evidence",
      q + "&" + related + "&order=created_at.desc&limit=100",
    ),
    c.table<v.Contact>("property_contacts", q + "&" + related),
    c.table<v.Permission>(
      "property_permissions",
      q + "&order=id.desc&limit=200",
    ),
    c.table<v.Outreach>(
      "property_outreach",
      q + "&" + related + "&order=created_at.desc&limit=100",
    ),
    c.table<v.Developer>("developers", q + "&order=name.asc&limit=200"),
    c.table<v.PartnerTemplate>(
      "partner_templates",
      "order=version.desc&limit=200",
    ),
    c.table<v.PartnerForm>(
      "partner_forms",
      q + "&order=updated_at.desc&limit=200",
    ),
    c.table<v.FormReview>(
      "form_reviews",
      q + "&order=created_at.desc&limit=200",
    ),
    c.table<v.Delivery>(
      "form_deliveries",
      q + "&order=created_at.desc&limit=200",
    ),
    c.table<v.ImportRun>(
      "property_imports",
      q + "&order=created_at.desc&limit=20",
    ),
    c.table<{
      id: string;
      purpose: string;
      channel: string;
      granted: boolean;
      created_at: string;
    }>("consents", q + "&order=created_at.desc,id.desc"),
  ]);
  const runId = selectedImport ?? imports[0]?.id;
  const importRows = runId
    ? await c.table<v.ImportRow>(
        "property_import_rows",
        q + "&import_id=eq." + runId + "&order=row_number.asc&limit=200",
      )
    : [];
  let admin: v.RealEstateData["admin"] = null;
  if (isAdmin(roles)) {
    const [
      properties,
      claims,
      evidence,
      forms,
      developers,
      templates,
      deliveries,
    ] = await Promise.all([
      c.table<v.Property>("properties", "order=updated_at.desc&limit=100"),
      c.table<v.Claim>("property_claims", "status=eq.NEEDS_REVIEW&limit=100"),
      c.table<v.Evidence>(
        "property_evidence",
        "order=created_at.desc&limit=200",
      ),
      c.table<v.PartnerForm>(
        "partner_forms",
        "order=updated_at.desc&limit=100",
      ),
      c.table<v.Developer>("developers", "order=updated_at.desc&limit=200"),
      c.table<v.PartnerTemplate>(
        "partner_templates",
        "order=created_at.desc&limit=200",
      ),
      c.table<v.Delivery>("form_deliveries", "order=created_at.desc&limit=100"),
    ]);
    admin = {
      properties,
      claims,
      evidence,
      forms,
      developers,
      templates,
      deliveries,
    };
  }
  let selectedProperty: v.Property | null = null;
  if (selected)
    selectedProperty = await owned<v.Property>(s, "properties", selected);
  return {
    properties: properties.slice(0, 20),
    page,
    hasNext: properties.length > 20,
    selectedProperty,
    claims,
    evidence,
    contacts,
    permissions,
    outreach,
    developers,
    templates,
    forms,
    reviews,
    deliveries,
    imports,
    importRows,
    matchingConsent: latestConsent(consents, "matching", "platform"),
    roles,
    userId: s.user.id,
    admin,
    providers: { feed: propertyFeed, delivery: livePartnerDelivery },
  };
}
async function mutation(s: Session, action: string, data: unknown) {
  const c = s.client,
    owner_id = s.user.id;
  switch (action) {
    case "property": {
      const { attested, ...input } = v.propertySchema.parse(data);
      void attested;
      return c.table("properties", "", "POST", { ...input, owner_id });
    }
    case "property-edit": {
      const { id, attested, ...input } = v.editPropertySchema.parse(data);
      void attested;
      await owned(s, "properties", id);
      return c.table("properties", eq(id) + "&" + owner(s), "PATCH", input);
    }
    case "import-preview":
    case "import": {
      const input = z
        .object({ meta: v.importMetaSchema, csv: z.string().max(256000) })
        .strict()
        .parse(data);
      let records;
      try {
        records = validateCsv(input.csv);
      } catch (e) {
        throw new ServiceError(
          400,
          e instanceof Error ? e.message : "Invalid CSV.",
        );
      }
      if (action === "import-preview")
        return { records, total: records.length };
      const run = await c.rpc<v.ImportRun>("import_properties", {
        meta: input.meta,
        records,
      });
      if (run.status === "FAILED")
        throw new ServiceError(
          400,
          "Import rejected and property changes rolled back. Check import history and source records.",
        );
      return run;
    }
    case "developer":
      return c.table("developers", "", "POST", {
        ...v.developerSchema.parse(data),
        owner_id,
      });
    case "developer-edit": {
      const { id, value } = z
        .object({ id: z.string().uuid(), value: v.developerSchema })
        .strict()
        .parse(data);
      const current = await owned<v.Developer>(s, "developers", id);
      if (current.is_demo !== value.is_demo)
        throw new ServiceError(400, "Demo mode cannot change.");
      const { is_demo, ...changes } = value;
      void is_demo;
      return c.table("developers", eq(id) + "&" + owner(s), "PATCH", changes);
    }
    case "demo-developers":
      return c.rpc("demo_developers");
    case "contact":
      return c.rpc("save_property_contact", {
        input: v.contactSchema.parse(data),
      });
    case "permission":
      return c.rpc("record_property_permission", {
        input: v.permissionSchema.parse(data),
      });
    case "outreach":
      return c.rpc("log_property_outreach", {
        input: v.outreachSchema.parse(data),
      });
    case "demo-evidence":
      return c.rpc("demo_property_evidence", {
        input: v.demoEvidenceSchema.parse(data),
      });
    case "claim-request":
      return c.rpc("request_claim_review", {
        input: v.claimRequestSchema.parse(data),
      });
    case "claim-review":
      return c.rpc("review_property_claim", {
        input: v.claimReviewSchema.parse(data),
      });
    case "form-create":
      return c.rpc("create_partner_form", {
        input: v.formCreateSchema.parse(data),
      });
    case "form-edit":
      return c.rpc("edit_partner_form", {
        input: v.formEditSchema.parse(data),
      });
    case "form-submit":
      return c.rpc("submit_partner_form", { input: v.idSchema.parse(data) });
    case "form-review":
      return c.rpc("review_partner_form", {
        input: v.formReviewSchema.parse(data),
      });
    case "form-simulate":
      return demoPartnerDelivery.deliver(
        c,
        z
          .object({ id: z.string().uuid(), demo_attestation: z.literal(true) })
          .strict()
          .parse(data),
      );
    case "partner-template": {
      if (!isAdmin(await assigned(s)))
        throw new ServiceError(403, "Administrator required.");
      const input = v.partnerTemplateSchema.parse(data),
        partner = (
          await c.table<v.Developer>("developers", eq(input.partner_id))
        )[0];
      if (!partner) throw new ServiceError(404, "Partner not found.");
      return c.table("partner_templates", "", "POST", {
        ...input,
        owner_id: partner.owner_id,
        is_demo: partner.is_demo,
        created_by: owner_id,
      });
    }
    default:
      throw new ServiceError(
        400,
        "Unsupported property action. Live delivery is blocked.",
      );
  }
}
export async function GET(request: NextRequest) {
  try {
    const s = await session(request);
    const response = NextResponse.json(await bootstrap(s, request), {
      headers: { "Cache-Control": "private, no-store" },
    });
    if (s.tokens) setSession(response, s.tokens);
    return response;
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const s = await session(request);
    const body = z
      .object({ action: z.string().max(50), data: z.unknown().optional() })
      .strict()
      .parse(await request.json());
    const result = await mutation(s, body.action, body.data);
    const response = NextResponse.json(
      { ok: true, result },
      { headers: { "Cache-Control": "no-store" } },
    );
    if (s.tokens) setSession(response, s.tokens);
    return response;
  } catch (e) {
    return failure(e);
  }
}
