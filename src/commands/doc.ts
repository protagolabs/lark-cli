import { readFileSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { exitWithError, printJson, printRecord } from "../utils/format.js";
import { larkApi } from "../utils/lark-api.js";
import { markdownToLarkBlocks } from "../utils/markdown.js";

/** Max blocks per documentBlockChildren.create() call. */
const BATCH_SIZE = 50;

/**
 * Register all doc subcommands on the given commander program.
 *
 * @param program - The root commander program.
 */
export function registerDocCommands(program: Command): void {
  const doc = program.command("doc").description("Document operations");

  doc
    .command("upload <file>")
    .description("Upload a markdown file as a Lark document")
    .option("--title <title>", "Document title (default: first heading or filename)")
    .option("--folder <folder_token>", "Target folder token")
    .option("--owner <open_id>", "Grant full_access to this user (open_id) after creation")
    .action(async (file: string, opts: any, cmd: Command) => {
      const json = cmd.optsWithGlobals().json;

      try {
        const filePath = path.resolve(file);
        const markdown = readFileSync(filePath, "utf-8");

        // Determine title: --title flag > first h1 > filename
        let title = opts.title;
        if (!title) {
          const headingMatch = markdown.match(/^#\s+(.+)$/m);
          title = headingMatch ? headingMatch[1].trim() : path.basename(file, path.extname(file));
        }

        // Create the document
        const createResp = await larkApi("POST", "/docx/v1/documents", {
          title,
          folder_token: opts.folder,
        });

        const documentId = createResp.data?.document?.document_id;
        if (!documentId) return exitWithError("Failed to create document.");

        // Convert markdown to Lark blocks
        const blocks = markdownToLarkBlocks(markdown);

        // Skip the first heading block if its text matches the document title
        // to avoid duplication (Lark doc already shows title)
        let startIndex = 0;
        if (blocks.length > 0 && blocks[0].block_type >= 3 && blocks[0].block_type <= 8) {
          const fieldName = `heading${blocks[0].block_type - 2}`;
          const heading = blocks[0][fieldName] as any;
          const headingText =
            heading?.elements?.map((e: any) => e.text_run?.content ?? "").join("") ?? "";
          if (headingText.trim() === title.trim()) {
            startIndex = 1;
          }
        }

        const blocksToAdd = blocks.slice(startIndex);

        // Add blocks in batches
        for (let i = 0; i < blocksToAdd.length; i += BATCH_SIZE) {
          const batch = blocksToAdd.slice(i, i + BATCH_SIZE);
          await larkApi(
            "POST",
            `/docx/v1/documents/${documentId}/blocks/${documentId}/children`,
            { children: batch },
          );
        }

        // Grant permission to specified user
        if (opts.owner) {
          await larkApi(
            "POST",
            `/drive/v1/permissions/${documentId}/members`,
            {
              member_type: "openid",
              member_id: opts.owner,
              perm: "full_access",
            },
            { type: "docx", need_notification: false },
          );
        }

        const docUrl = `https://larksuite.com/docx/${documentId}`;

        if (json) {
          return printJson({
            document_id: documentId,
            title,
            url: docUrl,
            blocks_added: blocksToAdd.length,
          });
        }

        printRecord({
          document_id: documentId,
          title,
          url: docUrl,
          blocks_added: blocksToAdd.length,
        });
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });

  doc
    .command("update <document_id> <file>")
    .description("Replace content of an existing Lark document with a markdown file")
    .option("--title <title>", "Update document title")
    .option("--resolve-comments", "Resolve all open comments before updating")
    .action(async (documentId: string, file: string, opts: any, cmd: Command) => {
      const json = cmd.optsWithGlobals().json;

      try {
        const filePath = path.resolve(file);
        const markdown = readFileSync(filePath, "utf-8");

        // Verify document exists and get title
        const docResp = await larkApi("GET", `/docx/v1/documents/${documentId}`);
        const docTitle = docResp.data?.document?.title ?? "";
        console.log(chalk.dim(`Document: ${docTitle} (${documentId})`));

        // Resolve open comments if requested
        let resolvedCount = 0;
        if (opts.resolveComments) {
          console.log(chalk.dim("Resolving open comments..."));
          let pageToken: string | undefined;

          do {
            const params: Record<string, string | boolean> = {
              file_type: "docx",
              is_solved: false,
              page_size: 100,
            };
            if (pageToken) params.page_token = pageToken;

            const commentsResp = await larkApi(
              "GET",
              `/drive/v1/files/${documentId}/comments`,
              undefined,
              params,
            );

            const items = commentsResp.data?.items ?? [];
            for (const comment of items) {
              if (!comment.comment_id) continue;
              await larkApi(
                "PATCH",
                `/drive/v1/files/${documentId}/comments/${comment.comment_id}`,
                { is_solved: true },
                { file_type: "docx" },
              );
              resolvedCount++;
            }

            pageToken = commentsResp.data?.has_more
              ? commentsResp.data?.page_token
              : undefined;
          } while (pageToken);

          if (resolvedCount > 0) {
            console.log(chalk.green(`Resolved ${resolvedCount} comment(s).`));
          } else {
            console.log(chalk.dim("No open comments to resolve."));
          }
        }

        // Get root page block to count existing children
        const rootResp = await larkApi(
          "GET",
          `/docx/v1/documents/${documentId}/blocks/${documentId}`,
        );
        const childCount: number = rootResp.data?.block?.children?.length ?? 0;

        // Delete all existing content blocks
        if (childCount > 0) {
          console.log(chalk.dim(`Deleting ${childCount} existing block(s)...`));
          await larkApi(
            "DELETE",
            `/docx/v1/documents/${documentId}/blocks/${documentId}/children/batch_delete`,
            { start_index: 0, end_index: childCount },
          );
        }

        // Convert markdown to Lark blocks
        const blocks = markdownToLarkBlocks(markdown);

        // Determine effective title for heading dedup
        const effectiveTitle = opts.title ?? docTitle;

        // Skip first heading if it matches document title
        let startIndex = 0;
        if (blocks.length > 0 && blocks[0].block_type >= 3 && blocks[0].block_type <= 8) {
          const fieldName = `heading${blocks[0].block_type - 2}`;
          const heading = blocks[0][fieldName] as any;
          const headingText =
            heading?.elements?.map((e: any) => e.text_run?.content ?? "").join("") ?? "";
          if (headingText.trim() === effectiveTitle.trim()) {
            startIndex = 1;
          }
        }

        const blocksToAdd = blocks.slice(startIndex);

        // Add new blocks in batches
        for (let i = 0; i < blocksToAdd.length; i += BATCH_SIZE) {
          const batch = blocksToAdd.slice(i, i + BATCH_SIZE);
          await larkApi(
            "POST",
            `/docx/v1/documents/${documentId}/blocks/${documentId}/children`,
            { children: batch },
          );
        }

        console.log(chalk.green(`Updated document with ${blocksToAdd.length} block(s).`));

        const result = {
          document_id: documentId,
          title: effectiveTitle,
          blocks_deleted: childCount,
          blocks_added: blocksToAdd.length,
          comments_resolved: resolvedCount,
        };

        if (json) {
          return printJson(result);
        }

        printRecord(result);
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });
}
