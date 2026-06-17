import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow Next.js to trace files outside the project root (e.g. parent repo's
  // generate-pdf.mjs, fonts/, templates/).  This is the repo root when running
  // locally and /build/ inside the Docker builder stage.
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  // Tell Next.js not to bundle playwright-related packages — they are native
  // binaries resolved at runtime, not bundleable.
  serverExternalPackages: ["playwright", "playwright-core", "@playwright/test"],
};

export default nextConfig;
