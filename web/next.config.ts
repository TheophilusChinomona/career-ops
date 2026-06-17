import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow Next.js to trace files outside the project root (e.g. parent repo's
  // generate-pdf.mjs, fonts/, templates/).  This is the repo root when running
  // locally and /build/ inside the Docker builder stage.
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  // Tell Turbopack (and webpack) that the parent-repo PDF helper is a Node.js
  // module — do NOT bundle it; require() it at runtime instead.
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
