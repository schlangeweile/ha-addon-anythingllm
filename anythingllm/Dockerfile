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

# Everything (SQLite database, LanceDB vectors, uploaded documents and
# the .env written by the onboarding wizard) lives on the persistent
# add-on /data volume; nothing else needs a volume or config mapping.
ENV STORAGE_DIR=/data

# Privacy: opt out of anonymous telemetry (upstream env). The entrypoint
# separately sets CHECKPOINT_DISABLE=1 (Prisma telemetry).
ENV DISABLE_ANONYMOUS_TELEMETRY=true
