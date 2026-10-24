# Home Assistant add-on image for AnythingLLM.
#
# Deliberately THIN: the upstream image is multi-arch (linux/amd64 +
# linux/arm64) and already runs the app (server + collector) through its
# own docker-entrypoint. This layer only pins the version and adapts
# user/storage for Home Assistant - do not add app logic here.
#
# Pin only plain version tags. The pg-/railway-/render- prefixed tags are
# deployment presets for external Postgres platforms (railway/render are
# amd64-only) - never use them here.
ARG ANYTHINGLLM_VERSION=1.18.0
FROM mintplexlabs/anythingllm:${ANYTHINGLLM_VERSION}

# Home Assistant mounts /data root-owned and does not override the image
# user; the upstream image declares USER anythingllm (UID 1000), which
# could not write to /data. The upstream entrypoint never drops or
# switches privileges itself, so starting as root makes the whole app run
# as root inside the isolated add-on container (usual add-on trust level).
USER root

# Everything persistent must live on the add-on /data volume. Upstream 1.18.0
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

# Privacy: opt out of anonymous telemetry. Upstream 1.18.0 evaluates
# DISABLE_TELEMETRY (server/utils/telemetry/index.js); the older
# DISABLE_ANONYMOUS_TELEMETRY name is silently ignored. The entrypoint
# separately sets CHECKPOINT_DISABLE=1 (Prisma telemetry).
ENV DISABLE_TELEMETRY=true
