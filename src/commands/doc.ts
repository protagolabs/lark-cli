import { readFileSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { getClient } from "../client.js";
import { checkResponse, exitWithError, printJson, printRecord } from "../utils/format.js";
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

        const client = getClient();

        // Create the document
        const createResp = await client.docx.document.create({
          data: {
            title,
            folder_token: opts.folder,
          },
        });
        checkResponse(createResp);

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
          const addResp = await client.docx.documentBlockChildren.create({
            path: {
              document_id: documentId,
              block_id: documentId,
            },
            data: {
              children: batch as any,
            },
          });
          checkResponse(addResp);
        }

        // Grant permission to specified user
        if (opts.owner) {
          const permResp = await client.drive.permission.member.create({
            path: { token: documentId },
            params: { type: "docx", need_notification: false },
            data: {
              member_type: "openid",
              member_id: opts.owner,
              perm: "full_access",
            },
          });
          checkResponse(permResp);
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
}
