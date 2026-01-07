import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * GET /api/docs
 * 
 * Returns the OpenAPI specification for the Converzia API.
 * This can be used with Swagger UI or other OpenAPI tools.
 */
export async function GET() {
  try {
    // Read the OpenAPI spec file
    const specPath = path.join(process.cwd(), "src/app/api/docs/openapi.json");
    const specContent = await readFile(specPath, "utf-8");
    const spec = JSON.parse(specContent);

    return NextResponse.json(spec, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
      },
    });
  } catch (error) {
    console.error("Error loading OpenAPI spec:", error);
    return NextResponse.json(
      { error: "Failed to load API documentation" },
      { status: 500 }
    );
  }
}
