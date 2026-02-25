import chalk from "chalk";
import Table from "cli-table3";

/**
 * Print raw JSON to stdout.
 *
 * @param data - Any serializable value.
 */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Print a list of objects as a formatted table.
 *
 * @param rows - Array of objects to display.
 * @param columns - Column definitions with header label and value accessor key.
 */
export function printTable(
  rows: Record<string, unknown>[],
  columns: { header: string; key: string }[],
): void {
  if (rows.length === 0) {
    console.log(chalk.yellow("No records found."));
    return;
  }

  const table = new Table({
    head: columns.map((c) => chalk.cyan(c.header)),
    wordWrap: true,
  });

  for (const row of rows) {
    table.push(columns.map((c) => String(row[c.key] ?? "")));
  }

  console.log(table.toString());
}

/**
 * Print a single record as key-value pairs.
 *
 * @param record - Object to display.
 */
export function printRecord(record: Record<string, unknown>): void {
  const table = new Table();
  for (const [key, value] of Object.entries(record)) {
    const display =
      typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "");
    table.push({ [chalk.cyan(key)]: display });
  }
  console.log(table.toString());
}

/**
 * Print error message and exit.
 *
 * @param msg - Error message string.
 */
export function exitWithError(msg: string): never {
  console.error(chalk.red(`Error: ${msg}`));
  process.exit(1);
}

/**
 * Check Lark API response and throw if error code is non-zero.
 *
 * @param resp - Raw Lark API response object.
 * @throws Error with Lark API error code and message.
 */
export function checkResponse(resp: { code?: number; msg?: string }): void {
  if (resp.code && resp.code !== 0) {
    throw new Error(`Lark API error ${resp.code}: ${resp.msg ?? "Unknown error"}`);
  }
}
