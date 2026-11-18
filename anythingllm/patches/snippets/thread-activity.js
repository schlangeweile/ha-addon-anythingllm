      // Home Assistant add-on: bump the thread timestamp so the sidebar can
      // sort by activity, not just creation time. The column is
      // @default(now()), not @updatedAt, so Prisma does not do this itself.
      // Best-effort: a missing/deleted thread must not fail the saved chat.
      if (data.threadId) {
        await prisma.workspace_threads
          .update({
            where: { id: data.threadId },
            data: { lastUpdatedAt: new Date() },
          })
          .catch((error) => {
            console.error(
              `[thread-activity] could not bump thread ${data.threadId}: ${error.message}`
            );
          });
      }
