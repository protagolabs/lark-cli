import { Command } from "commander";
import { registerBitableCommands } from "./commands/bitable.js";
import { registerMessageCommands } from "./commands/message.js";

const program = new Command();

program
  .name("lark")
  .description("CLI tool for Lark/Feishu Open API")
  .version("0.1.0")
  .option("--json", "Output raw JSON instead of formatted tables", false);

registerBitableCommands(program);
registerMessageCommands(program);

program.parse();
