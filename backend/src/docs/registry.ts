import { z } from "zod";

/**
 * Minimal OpenAPI 3.1 registry. Controllers register each route with its Zod
 * schemas; /docs serves Swagger UI over the generated document, so the docs
 * are derived from the same schemas that validate requests.
 */
interface Route {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;                      // /v1/... with {param} segments
  summary: string;
  tag: string;
  auth: boolean;
  body?: z.ZodType;
  query?: z.ZodType;
  response?: z.ZodType;
  status?: number;
}

const routes: Route[] = [];
export function apiRoute(r: Route): void { routes.push(r); }

export function buildOpenApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    const op: Record<string, unknown> = {
      summary: r.summary,
      tags: [r.tag],
      security: r.auth ? [{ bearerAuth: [] }] : [],
      responses: {
        [String(r.status ?? (r.method === "post" ? 201 : 200))]: {
          description: "Success",
          ...(r.response
            ? { content: { "application/json": { schema: z.toJSONSchema(r.response, { io: "output", target: "draft-2020-12" }) } } }
            : {}),
        },
        "422": { description: "Validation failed (error envelope)" },
        ...(r.auth ? { "401": { description: "Unauthenticated" } } : {}),
      },
    };
    if (r.body) {
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: z.toJSONSchema(r.body, { io: "input", target: "draft-2020-12" }) } },
      };
    }
    const params: unknown[] = [];
    for (const m of r.path.matchAll(/\{(\w+)\}/g)) {
      params.push({ name: m[1], in: "path", required: true, schema: { type: "string" } });
    }
    if (r.query) {
      const qs = z.toJSONSchema(r.query, { io: "input", target: "draft-2020-12" }) as any;
      for (const [name, schema] of Object.entries(qs.properties ?? {})) {
        params.push({ name, in: "query", required: (qs.required ?? []).includes(name), schema });
      }
    }
    if (params.length) op.parameters = params;
    (paths[r.path] ??= {})[r.method] = op;
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "MedPilot API", version: "1.0.0",
      description: "Backend for the MedPilot mobile app. All responses use the documented error envelope on failure.",
    },
    servers: [{ url: "/" }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
    paths,
  };
}
