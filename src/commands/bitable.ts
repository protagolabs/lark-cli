import { Command } from "commander";
import { getClient } from "../client.js";
import { checkResponse, exitWithError, printJson, printRecord, printTable } from "../utils/format.js";

/**
 * Register all bitable subcommands on the given commander program.
 *
 * @param program - The root commander program.
 */
export function registerBitableCommands(program: Command): void {
  const bitable = program.command("bitable").description("Bitable (multi-dimensional table) operations");

  bitable
    .command("list <app_token>")
    .description("List tables in a bitable app")
    .action(async (appToken: string, _, cmd: Command) => {
      const json = cmd.optsWithGlobals().json;
      try {
        const client = getClient();
        const resp = await client.bitable.appTable.list({
          path: { app_token: appToken },
        });
        checkResponse(resp);

        if (!resp.data?.items) return exitWithError("No tables found.");

        if (json) return printJson(resp.data.items);

        printTable(
          resp.data.items as Record<string, unknown>[],
          [
            { header: "Table ID", key: "table_id" },
            { header: "Name", key: "name" },
            { header: "Revision", key: "revision" },
          ],
        );
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });

  bitable
    .command("fields <app_token> <table_id>")
    .description("List fields of a table")
    .action(async (appToken: string, tableId: string, _, cmd: Command) => {
      const json = cmd.optsWithGlobals().json;
      try {
        const client = getClient();
        const resp = await client.bitable.appTableField.list({
          path: { app_token: appToken, table_id: tableId },
        });
        checkResponse(resp);

        if (!resp.data?.items) return exitWithError("No fields found.");

        if (json) return printJson(resp.data.items);

        printTable(
          resp.data.items as Record<string, unknown>[],
          [
            { header: "Field ID", key: "field_id" },
            { header: "Name", key: "field_name" },
            { header: "Type", key: "type" },
          ],
        );
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });

  bitable
    .command("records <app_token> <table_id>")
    .description("List records of a table")
    .option("--filter <filter>", "Filter expression")
    .option("--page-size <size>", "Number of records per page", "20")
    .option("--page-token <token>", "Page token for pagination")
    .action(async (appToken: string, tableId: string, opts: any, cmd: Command) => {
      const json = cmd.optsWithGlobals().json;
      try {
        const client = getClient();
        const resp = await client.bitable.appTableRecord.list({
          path: { app_token: appToken, table_id: tableId },
          params: {
            page_size: Number(opts.pageSize),
            page_token: opts.pageToken,
            filter: opts.filter,
          },
        });
        checkResponse(resp);

        if (!resp.data?.items) return exitWithError("No records found.");

        if (json) return printJson(resp.data);

        const records = resp.data.items.map((item: any) => ({
          record_id: item.record_id,
          ...item.fields,
        }));

        // Dynamically build columns from first record
        const keys = Object.keys(records[0] || {});
        const columns = keys.map((k) => ({ header: k, key: k }));

        printTable(
          records.map((r: Record<string, unknown>) => {
            const flat: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(r)) {
              flat[k] = typeof v === "object" ? JSON.stringify(v) : v;
            }
            return flat;
          }),
          columns,
        );

        if (resp.data.page_token) {
          console.log(`\nNext page token: ${resp.data.page_token}`);
        }
        console.log(`Total: ${resp.data.total ?? "unknown"}`);
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });

  bitable
    .command("get <app_token> <table_id> <record_id>")
    .description("Get a single record")
    .action(async (appToken: string, tableId: string, recordId: string, _, cmd: Command) => {
      const json = cmd.optsWithGlobals().json;
      try {
        const client = getClient();
        const resp = await client.bitable.appTableRecord.get({
          path: { app_token: appToken, table_id: tableId, record_id: recordId },
        });
        checkResponse(resp);

        if (!resp.data?.record) return exitWithError("Record not found.");

        if (json) return printJson(resp.data.record);

        printRecord({
          record_id: resp.data.record.record_id,
          ...(resp.data.record.fields as Record<string, unknown>),
        });
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });

  bitable
    .command("create <app_token> <table_id>")
    .description("Create a record")
    .requiredOption("--data <json>", "Record fields as JSON")
    .action(async (appToken: string, tableId: string, opts: any, cmd: Command) => {
      const json = cmd.optsWithGlobals().json;
      try {
        const fields = JSON.parse(opts.data);
        const client = getClient();
        const resp = await client.bitable.appTableRecord.create({
          path: { app_token: appToken, table_id: tableId },
          data: { fields },
        });
        checkResponse(resp);

        if (!resp.data?.record) return exitWithError("Failed to create record.");

        if (json) return printJson(resp.data.record);

        printRecord({
          record_id: resp.data.record.record_id,
          ...(resp.data.record.fields as Record<string, unknown>),
        });
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });

  bitable
    .command("update <app_token> <table_id> <record_id>")
    .description("Update a record")
    .requiredOption("--data <json>", "Record fields to update as JSON")
    .action(async (appToken: string, tableId: string, recordId: string, opts: any, cmd: Command) => {
      const json = cmd.optsWithGlobals().json;
      try {
        const fields = JSON.parse(opts.data);
        const client = getClient();
        const resp = await client.bitable.appTableRecord.update({
          path: { app_token: appToken, table_id: tableId, record_id: recordId },
          data: { fields },
        });
        checkResponse(resp);

        if (!resp.data?.record) return exitWithError("Failed to update record.");

        if (json) return printJson(resp.data.record);

        printRecord({
          record_id: resp.data.record.record_id,
          ...(resp.data.record.fields as Record<string, unknown>),
        });
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });

  bitable
    .command("delete <app_token> <table_id> <record_id>")
    .description("Delete a record")
    .action(async (appToken: string, tableId: string, recordId: string) => {
      try {
        const client = getClient();
        const resp = await client.bitable.appTableRecord.delete({
          path: { app_token: appToken, table_id: tableId, record_id: recordId },
        });
        checkResponse(resp);

        if (resp.data?.deleted) {
          console.log(`Deleted record: ${recordId}`);
        } else {
          exitWithError("Failed to delete record.");
        }
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });

  bitable
    .command("search <app_token> <table_id>")
    .description("Search records")
    .option("--filter <filter>", "Filter expression (JSON)")
    .option("--page-size <size>", "Number of records per page", "20")
    .option("--page-token <token>", "Page token for pagination")
    .action(async (appToken: string, tableId: string, opts: any, cmd: Command) => {
      const json = cmd.optsWithGlobals().json;
      try {
        const client = getClient();
        const data: Record<string, unknown> = {
          page_size: Number(opts.pageSize),
        };
        if (opts.pageToken) data.page_token = opts.pageToken;
        if (opts.filter) data.filter = JSON.parse(opts.filter);

        const resp = await client.bitable.appTableRecord.search({
          path: { app_token: appToken, table_id: tableId },
          data: data as any,
        });
        checkResponse(resp);

        if (!resp.data?.items) return exitWithError("No records found.");

        if (json) return printJson(resp.data);

        const records = resp.data.items.map((item: any) => ({
          record_id: item.record_id,
          ...item.fields,
        }));

        const keys = Object.keys(records[0] || {});
        const columns = keys.map((k) => ({ header: k, key: k }));

        printTable(
          records.map((r: Record<string, unknown>) => {
            const flat: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(r)) {
              flat[k] = typeof v === "object" ? JSON.stringify(v) : v;
            }
            return flat;
          }),
          columns,
        );

        if (resp.data.page_token) {
          console.log(`\nNext page token: ${resp.data.page_token}`);
        }
        console.log(`Total: ${resp.data.total ?? "unknown"}`);
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });
}
