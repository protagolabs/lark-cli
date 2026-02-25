import { Command } from "commander";
import { getClient } from "../client.js";
import { checkResponse, exitWithError, printJson, printRecord } from "../utils/format.js";

const VALID_ID_TYPES = ["open_id", "user_id", "union_id", "email", "chat_id"] as const;
type ReceiveIdType = (typeof VALID_ID_TYPES)[number];

/**
 * Register all message subcommands on the given commander program.
 *
 * @param program - The root commander program.
 */
export function registerMessageCommands(program: Command): void {
  const msg = program.command("msg").description("Messaging operations");

  msg
    .command("send")
    .description("Send a message")
    .requiredOption("--to <receive_id>", "Recipient ID")
    .option("--type <id_type>", "Recipient ID type (open_id, user_id, union_id, email, chat_id)", "chat_id")
    .option("--msg-type <msg_type>", "Message type (text, post, interactive)", "text")
    .requiredOption("--content <content>", "Message content (string or JSON)")
    .action(async (opts: any, cmd: Command) => {
      const json = cmd.optsWithGlobals().json;
      const idType = opts.type as ReceiveIdType;

      if (!VALID_ID_TYPES.includes(idType)) {
        return exitWithError(`Invalid --type: ${idType}. Must be one of: ${VALID_ID_TYPES.join(", ")}`);
      }

      try {
        let content: string;
        if (opts.msgType === "text") {
          // Wrap plain text into Lark text message format if not already JSON
          try {
            JSON.parse(opts.content);
            content = opts.content;
          } catch {
            content = JSON.stringify({ text: opts.content });
          }
        } else {
          content = opts.content;
        }

        const client = getClient();
        const resp = await client.im.message.create({
          params: { receive_id_type: idType },
          data: {
            receive_id: opts.to,
            msg_type: opts.msgType,
            content,
          },
        });

        checkResponse(resp);

        if (!resp.data) return exitWithError("Failed to send message.");

        if (json) return printJson(resp.data);

        printRecord({
          message_id: resp.data.message_id,
          chat_id: resp.data.chat_id,
          create_time: resp.data.create_time,
          msg_type: resp.data.msg_type,
        } as Record<string, unknown>);

        console.log("Message sent successfully.");
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });
}
