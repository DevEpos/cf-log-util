import { parseArgs } from "./lib/args.js";
import { CliError } from "./lib/cli-error.js";
import { DEFAULT_PROPERTIES } from "./lib/constants.js";
import { discoverFileProperties, transformLine } from "./lib/log-processing.js";
import { selectProperties } from "./lib/interactive.js";
import { expandPropertiesForRows, formatCsvRow, outputCsv, outputJson } from "./lib/output.js";
import { spawnCfLogsMerged } from "./lib/cf-stream.js";
import { readFileSync } from "node:fs";

process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") {
    process.exit(0);
  }

  throw error;
});

async function streamRecords(lineSource, orderedProperties, filterAst, csvOutput, allProperties) {
  if (csvOutput) {
    process.stdout.write(orderedProperties.join(",") + "\n");
  }

  for await (const { line, app } of lineSource) {
    const row = transformLine(line, orderedProperties, filterAst, app, allProperties);

    if (!row) {
      continue;
    }

    process.stdout.write(
      (csvOutput ? formatCsvRow(row, orderedProperties) : JSON.stringify(row)) + "\n",
    );
  }
}

function transformFile(inputFile, orderedProperties, filterAst, csvOutput, allProperties) {
  const lines = readFileSync(inputFile, "utf8").split(/\r?\n/);
  const resultRows = [];

  for (const line of lines) {
    const row = transformLine(line, orderedProperties, filterAst, undefined, allProperties);
    if (row) {
      resultRows.push(row);
    }
  }

  if (csvOutput) {
    outputCsv(
      resultRows,
      allProperties ? expandPropertiesForRows(orderedProperties, resultRows) : orderedProperties,
    );
  } else {
    outputJson(resultRows);
  }
}

export async function main() {
  let parsedArgs;
  try {
    parsedArgs = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CliError) {
      console.error(error.helpText ?? error.message);
      process.exit(error.exitCode);
    }
    throw error;
  }

  const {
    inputFile,
    appNames,
    additionalProperties,
    filterAst,
    csvOutput,
    allProperties,
    interactiveProperties,
    recent,
  } = parsedArgs;
  let orderedProperties = [...DEFAULT_PROPERTIES, ...additionalProperties];

  if (interactiveProperties) {
    orderedProperties = await selectProperties(discoverFileProperties(inputFile));
  }

  if (appNames.length > 1 && !orderedProperties.includes("app")) {
    const defaultPropertyCount = orderedProperties.filter((property) => DEFAULT_PROPERTIES.includes(property)).length;
    orderedProperties.splice(defaultPropertyCount, 0, "app");
  }

  if (appNames.length > 0) {
    if (csvOutput && allProperties) {
      throw new Error("--all-props cannot be combined with --csv when streaming app logs");
    }
    await streamRecords(spawnCfLogsMerged(appNames, recent), orderedProperties, filterAst, csvOutput, allProperties);
    return;
  }

  transformFile(inputFile, orderedProperties, filterAst, csvOutput, allProperties);
}
