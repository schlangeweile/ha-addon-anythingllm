# AnythingLLM

All-in-one, open-source AI chat application by Mintplex Labs with a
built-in document pipeline (RAG), embedded storage and native
multi-user administration. Runs fully local; bring your own model
endpoints (OpenAI, Anthropic, Google, any OpenAI-compatible server
such as DashScope/Ollama, and more).

## How it works

The add-on is a single service based on the official multi-arch
AnythingLLM image. Inside the container the upstream entrypoint runs
the web app and its document collector; the embedded SQLite database
and the LanceDB vector store require no external services.

| Aspect   | Detail                                       |
| -------- | -------------------------------------------- |
| Web UI   | port 3001 (mapped to 3001 by default)        |
| Storage  | everything persists on the add-on `/data` volume |
| Database | embedded SQLite + LanceDB (no external DB)   |
| Config   | in the web UI only (stored in the database)  |

Anonymous telemetry is disabled by default.

## First start

1. Open `http://<home-assistant>:3001`.
2. The onboarding wizard asks for your name, username and password -
   this first account becomes the **administrator**.
3. In the wizard (or later under the gear icon → **LLM Preference**),
   configure a provider:
   - **AnythingLLM** (OpenAI-compatible custom endpoint) covers most
     cases: set the base URL and API key of your provider
     (e.g. a DashScope OpenAI-compatible endpoint, an Ollama server, …).
   - Native provider presets are also available.
4. Optional: configure **Embedding Preferences** for the knowledge base
   (RAG). Without embeddings, plain chat still works.

## Multiple users (household setup)

1. Gear icon → **Admin Tools** → enable **Multi-User Mode**.
2. Create accounts in the admin panel and assign roles:
   - **admin** - full control, manages users and settings
   - **manager** - manages workspaces/documents, not admin settings
   - **default** - sees only workspaces explicitly assigned to them
3. Users can be deleted (and passwords reset) by admins at any time -
   user administration is built in, no external tools required.

## Knowledge base (RAG)

Upload documents (PDF, Word, CSV, text, …) into a workspace and embed
them. Embeddings run through the provider configured under Embedding
Preferences; vectors are stored locally in LanceDB on `/data`.

## Local models / built-in LLM

The add-on supports remote endpoints only in practice. The optional
built-in local LLM engine (Lemonade/llama.cpp) downloads large model
runtimes at first use and is not suited for low-RAM ARM devices such as
the Odroid N2+ - use remote API endpoints instead, or a separate
Ollama server on capable hardware.

## Backups & updates

- A Home Assistant add-on backup includes the `/data` volume and with
  it the complete state (accounts, chats, documents, vectors, settings).
- On every start the app applies pending database migrations
  automatically. Add-on updates simply pin a newer AnythingLLM version;
  your data survives.

## Troubleshooting

- **Container restarts immediately / log shows `Illegal instruction`**:
  this indicates a binary that requires ARMv8.2+ (LSE) CPU features on
  an ARMv8.0 device (e.g. Odroid N2+, Raspberry Pi 3/4). Please open an
  issue in the add-on repository with the log excerpt.
- **Cannot write to /data**: the add-on runs the app as root inside the
  container on purpose (the persistent volume is root-owned); if you
  changed the image, keep the `USER root` directive.
- Logs: add-on page → **Log** tab. The entrypoint prints Prisma
  migration output, then server and collector logs.
