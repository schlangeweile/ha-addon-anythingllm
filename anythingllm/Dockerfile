# Home Assistant add-on image for AnythingLLM.
#
# Deliberately THIN: the upstream image is multi-arch (linux/amd64 +
# linux/arm64) and already runs the app (server + collector) through its
# own docker-entrypoint. Our layer only pins the version, adapts
# user/storage for Home Assistant and overlays a frontend built from the
# public UI fork. Server, collector, Prisma engines and the Chromium
# runtime stay upstream - do not add app logic here.
#
# Pin only plain version tags. The pg-/railway-/render- prefixed tags are
# deployment presets for external Postgres platforms (railway/render are
# amd64-only) - never use them here.
ARG ANYTHINGLLM_VERSION=1.19.0

# Frontend overlay. The UI fork is the public branch ha-ui/v1.19.0 of
# schlangeweile/anything-llm (upstream tag v1.19.0 + our UI commits). The
# stage runs natively on the builder ($BUILDPLATFORM), so the frontend build
# is plain JS and never runs under QEMU; it has no ARMv8.0 implications.
# Pin the commit SHA, not a branch: the tarball URL is then immutable. The
# SHA-256 makes the downloaded tarball reproducible, and the version check
# fails the build when the fork is based on a different upstream release.
# Keep NODE_ENV=production: a dev-mode React bundle is ~468 KB larger.
ARG UI_FORK_SHA=14201e42efeddb3e4c5eb951a028e5fcac4dcbb1
ARG UI_FORK_SHA256=abb6d242d5f3ea5f9e7de6144a5bc92b4c6865057050dadeaf8ec8eecf992226

FROM --platform=$BUILDPLATFORM node:18-slim AS ui
ARG UI_FORK_SHA
ARG UI_FORK_SHA256
ARG ANYTHINGLLM_VERSION
ENV NODE_ENV=production
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && curl -fsSL -o /tmp/src.tgz "https://codeload.github.com/schlangeweile/anything-llm/tar.gz/${UI_FORK_SHA}" \
 && echo "${UI_FORK_SHA256}  /tmp/src.tgz" | sha256sum -c - \
 && mkdir -p /src \
 && tar -xzf /tmp/src.tgz -C /src --strip-components=1 \
 && rm -f /tmp/src.tgz
RUN ver=$(node -p "require('/src/server/package.json').version") \
 && [ "$ver" = "${ANYTHINGLLM_VERSION}" ] \
 || { echo "UI fork is $ver, base image is ${ANYTHINGLLM_VERSION}"; exit 1; }
WORKDIR /src/frontend
# NODE_ENV=production is the bundle contract (no React dev build). Yarn 1
# otherwise omits devDependencies, which includes vite itself; --production=false
# installs the build toolchain while the build below still sees production.
RUN yarn install --frozen-lockfile --production=false --network-timeout 600000 \
 && yarn build

FROM mintplexlabs/anythingllm:${ANYTHINGLLM_VERSION}

# Home Assistant mounts /data root-owned and does not override the image
# user; the upstream image declares USER anythingllm (UID 1000), which
# could not write to /data. The upstream entrypoint never drops or
# switches privileges itself, so starting as root makes the whole app run
# as root inside the isolated add-on container (usual add-on trust level).
USER root

# Everything persistent must live on the add-on /data volume. Upstream 1.19.0
# honors STORAGE_DIR for documents/LanceDB/vector-cache, but the SQLite
# database and the runtime .env are written relative to /app/server instead
# (schema.prisma has a literal url "file:../storage/anythingllm.db", the env
# dump goes to /app/server/.env). Redirect both into /data with symlinks so
# add-on updates/reinstalls keep accounts, chats, vectors and LLM settings.
# The symlinked .env starts dangling; the app creates /data/.env on first
# boot (the shipped default .env only carries values we override anyway).
# The document-upload hotdir is resolved by the SERVER as
# $STORAGE_DIR/../../collector/hotdir, which only matches the collector's
# own fixed /app/collector/hotdir when STORAGE_DIR sits at /app/server/storage.
# Bridge /collector/hotdir so uploads work from /data as well.
ENV STORAGE_DIR=/data

RUN rm -rf /app/server/storage \
 && ln -s /data /app/server/storage \
 && ln -sf /data/.env /app/server/.env \
 && mkdir -p /collector \
 && ln -s /app/collector/hotdir /collector/hotdir

# Overlay the frontend built from the UI fork. Docker copies the CONTENTS of
# dist into the existing public directory, so index.js/index.css and hashed
# assets replace their upstream counterparts; server, collector and entrypoint
# are untouched. The old upstream assets remain in the base layer (accepted,
# ~16 MB; the plan measured ~8.6 MB additional registry layer). The overlay
# runs before apply.js so the server patches always see the upstream server
# files; the CSS snippets now live in the fork and no longer touch public/.
COPY --from=ui /src/frontend/dist /app/server/public

# Experimental local patch (not upstream): DeepSeek Search/Fetch support,
# image attachments for the native DeepSeek provider, a Content-Security-
# Policy for the SPA, and a thread-activity timestamp update. Upstream 1.19.0
# has no DeepSeek web-search provider, so this layer adds one plus an optional
# DeepSeek Fetch path for the agent's scrape skill. Both are off by default and
# controlled by the add-on options deepseek_search / deepseek_fetch. Upstream
# also hard-codes DeepSeek as text-only and drops chat images even though
# deepseek-flash accepts them; the patch forwards images for that model (and
# still strips them for text-only models such as deepseek-v4-pro). The CSP
# closes the JWT-in-localStorage gap, and WorkspaceChats.new bumps a thread's
# lastUpdatedAt so the sidebar can sort by activity. The patch script fails the
# build if the pinned upstream version or an anchor changes - re-check
# patches/ on every upstream bump. Remove the Search/Fetch part once upstream
# supports DeepSeek Search natively.
COPY patches /opt/anythingllm-patches
RUN node /opt/anythingllm-patches/apply.js \
 && rm -rf /opt/anythingllm-patches

# Privacy: opt out of anonymous telemetry. Upstream 1.19.0 evaluates
# DISABLE_TELEMETRY (server/utils/telemetry/index.js); the older
# DISABLE_ANONYMOUS_TELEMETRY name is silently ignored. The entrypoint
# separately sets CHECKPOINT_DISABLE=1 (Prisma telemetry).
ENV DISABLE_TELEMETRY=true

# Web scraping / URL ingestion is intentionally NOT enabled (Variant B).
# The upstream image ships a Chromium from the Chrome 119 era (late 2023).
# On amd64 Puppeteer cannot find it as root (HOME=/root, browser under
# /app/.cache/puppeteer); on both architectures Chromium refuses to start as
# root without --no-sandbox, and SYS_ADMIN does not help because of that root
# check. Enabling --no-sandbox would run an outdated browser unsandboxed as
# root, so the add-on leaves it disabled.
# Consequence: static URLs work via the collector's plain-HTTP fallback;
# JavaScript-heavy pages and Website Depth do not. The SERP-based Web Search
# agent skill is unaffected. Do not add HOME/ANYTHINGLLM_CHROMIUM_ARGS or
# SYS_ADMIN here without upgrading the browser and re-running the ARMv8.0
# verification; see DOCS.md "Web search and web pages".
