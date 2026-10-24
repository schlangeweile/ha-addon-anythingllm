# AnythingLLM for Home Assistant (arm64 & amd64)

A Home Assistant add-on running [AnythingLLM](https://anythingllm.com)
by Mintplex Labs - the all-in-one, open-source AI chat application with
a built-in document pipeline (RAG), embedded storage and native
multi-user administration. Everything runs locally in a single
container; you supply the model endpoints (OpenAI, Anthropic, any
OpenAI-compatible server such as DashScope or Ollama, ...).

It targets devices like the **Hardkernel Odroid N2+** and Raspberry Pi
4/5 (aarch64) as well as x86-64 machines. The add-on is a thin layer on
the official multi-arch AnythingLLM image: no external database, no
object storage, no extra services - SQLite and the LanceDB vector store
are embedded, and all state persists on the add-on's data volume.

> **Status:** experimental. Built from the official multi-arch image;
> verification on ARMv8.0 hardware (Odroid N2+) is still in progress -
> see the add-on changelog before relying on it.

| Architecture | Status |
| ------------ | ------ |
| aarch64 (ARMv8.0) | pending verification on Odroid N2+ |
| amd64        | built from the same multi-arch image |

## Why this exists

Compared to a full chat-platform stack (the sibling
[LibreChat add-on](https://github.com/schlangeweile/ha-addon-librechat)
ships FerretDB + PostgreSQL + Meilisearch), AnythingLLM needs no
external services, runs with roughly half the memory footprint
(documented ~300 MB typical / ~500 MB peak) and has user administration
built in: accounts, roles (admin/manager/default) and per-workspace
access are managed from the admin dashboard - no extra tooling.

## Installation

[![Open your Home Assistant instance and show the add-on repository dialog.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository=https%3A%2F%2Fgithub.com%2Fschlangeweile%2Fha-addon-anythingllm)

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**.
2. Open the **⋮ menu → Repositories**, add
   `https://github.com/schlangeweile/ha-addon-anythingllm`.
3. Refresh, open **AnythingLLM** from the store and click **Install**
   (the finished image is pulled for your device's architecture).
4. Start the add-on and open `http://<home-assistant>:3001`.
   Complete the onboarding wizard - the first account becomes the
   administrator. For household sharing, enable **Multi-User Mode**
   under Admin Tools and create accounts with the **default** role.

Configuration happens entirely in the web UI (stored in the embedded
database). See the add-on's **Documentation** tab for details (RAG
setup, providers, backups, troubleshooting).

## Updating to a newer AnythingLLM

The add-on version tracks the bundled AnythingLLM version. To move to a
newer release, bump the `ANYTHINGLLM_VERSION` default in
`anythingllm/Dockerfile` and the add-on `version` in
`anythingllm/config.yaml` - GitHub Actions builds the new images and the
supervisor offers the add-on update in the store. Database migrations
apply automatically on start.

## Credits

- [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) by
  Mintplex Labs and contributors (MIT)

Licensed under Apache 2.0 - see [LICENSE](LICENSE).
