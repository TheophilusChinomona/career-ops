# ──────────────────────────────────────────────────────────────────────────────
# Build context: repo root (career-ops/)
# so we can COPY the parent's generate-pdf.mjs, fonts/, templates/, config/, cv.md
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:24-slim AS builder

WORKDIR /build/web

# Install dependencies first (layer-cached unless package files change)
COPY web/package.json web/package-lock.json ./
RUN npm ci

# Copy Prisma schema + config so we can generate the client
COPY web/prisma ./prisma
COPY web/prisma.config.ts ./

# Generate Prisma client into src/generated/prisma
RUN npx prisma generate

# Copy the rest of the web source
COPY web/ .

# Copy parent repo assets so pdf.ts can resolve ../../../generate-pdf.mjs
# (import is 3 levels up from src/render/pdf.ts → web root → /build/ → build context)
# At build time WORKDIR is /build/web so ../../../ → /  (build context root)
# We place them at /build/ (one above /build/web)
COPY generate-pdf.mjs /build/
COPY fonts/ /build/fonts/
COPY templates/ /build/templates/

# playwright is used by generate-pdf.mjs at runtime.  It lives in the parent
# repo's node_modules (not web's), so we copy it here so Turbopack can resolve
# the import chain during the Next.js build.
COPY node_modules/playwright /build/node_modules/playwright
COPY node_modules/playwright-core /build/node_modules/playwright-core

# Build Next.js (standalone output enabled in next.config.ts)
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:24-slim AS runtime

# System deps required by Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright and its Chromium browser
# PLAYWRIGHT_BROWSERS_PATH keeps the browser inside the image, not ~/.cache
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium

# ── App layout ────────────────────────────────────────────────────────────────
# The app runs with cwd=/app/web; parent repo files sit one level up at /app.
# pdf.ts resolves baseDir as path.resolve(process.cwd(), '..') → /app/
# and OUTPUT_DIR as process.cwd()/storage/pdfs → /app/web/storage/pdfs

WORKDIR /app/web

# Copy standalone Next.js server (includes its own trimmed node_modules)
COPY --from=builder /build/web/.next/standalone/web/ ./
# Standalone server expects static assets alongside itself
COPY --from=builder /build/web/.next/static ./.next/static
# Public directory (favicon, etc.)
COPY --from=builder /build/web/public ./public

# Prisma schema + migrations (needed for `prisma migrate deploy`)
COPY --from=builder /build/web/prisma ./prisma
COPY --from=builder /build/web/prisma.config.ts ./

# Generated Prisma client
COPY --from=builder /build/web/src/generated ./src/generated

# Prisma CLI + engine needed to run `prisma migrate deploy` at startup.
# The standalone bundle omits devDependencies, so we bring them explicitly.
COPY --from=builder /build/web/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /build/web/node_modules/prisma ./node_modules/prisma
COPY --from=builder /build/web/node_modules/@prisma ./node_modules/@prisma

# Parent repo assets (generate-pdf.mjs + fonts/ + templates/ + config/ + cv.md)
# These must be one directory above /app/web, i.e. at /app/
COPY generate-pdf.mjs /app/
COPY fonts/ /app/fonts/
COPY templates/ /app/templates/
COPY config/ /app/config/
COPY cv.md /app/

# Storage directory for generated PDFs (can also be mounted as a volume)
RUN mkdir -p /app/web/storage/pdfs

# Playwright browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Next.js production port
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Entrypoint: migrate then start
COPY web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
