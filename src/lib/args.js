import { parseFilterExpr } from "./filter.js";
import { CliError } from "./cli-error.js";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    throw new CliError("", { exitCode: argv.length === 0 ? 1 : 0, helpText: buildHelpText() });
  }

  const additionalProperties = [];
  let inputFile = null;
  const appNames = [];
  let filterAst = null;
  let csvOutput = false;
  let allProperties = false;
  let interactiveProperties = false;
  let recent = false;

  const addProperties = (value) => {
    const properties = value
      .split(",")
      .map((property) => property.trim())
      .filter((property) => property.length > 0);
    if (properties.length === 0) {
      throw new CliError("Missing property list for -p");
    }
    additionalProperties.push(...properties);
  };

  const addAppNames = (value) => {
    const names = value
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    if (names.length === 0) {
      throw new CliError("Missing app name for -a");
    }
    appNames.push(...names);
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--csv") {
      csvOutput = true;
      continue;
    }

    if (arg === "--all-props") {
      allProperties = true;
      continue;
    }

    if (arg === "--recent") {
      recent = true;
      continue;
    }

    if (arg === "-i" || arg === "--interactive") {
      interactiveProperties = true;
      continue;
    }

    if (arg === "-p") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new CliError("Missing property list for -p");
      }
      addProperties(value);
      i += 1;
      continue;
    }

    if (arg.startsWith("-p=")) {
      addProperties(arg.slice("-p=".length));
      continue;
    }

    if (arg === "-a") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new CliError("Missing app name for -a");
      }
      addAppNames(value);
      i += 1;
      continue;
    }

    if (arg.startsWith("-a=")) {
      addAppNames(arg.slice("-a=".length));
      continue;
    }

    if (arg === "-f") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new CliError("Missing expression for -f");
      }
      try {
        filterAst = parseFilterExpr(value);
      } catch (err) {
        throw new CliError(`Invalid -f expression: ${err.message}`);
      }
      i += 1;
      continue;
    }

    if (arg.startsWith("-f=")) {
      try {
        filterAst = parseFilterExpr(arg.slice("-f=".length));
      } catch (err) {
        throw new CliError(`Invalid -f expression: ${err.message}`);
      }
      continue;
    }

    if (arg === "-") {
      throw new CliError("Stdin input is not supported; pass a log file or use -a <name>");
    }

    if (inputFile === null && appNames.length === 0) {
      inputFile = arg;
      continue;
    }

    throw new CliError(`Unexpected argument: ${arg}`);
  }

  if (appNames.length > 0 && inputFile !== null) {
    throw new CliError("-a cannot be combined with an input file");
  }

  if (appNames.length === 0 && inputFile === null) {
    throw new CliError("Missing input: pass a file or -a <name>");
  }

  if (recent && appNames.length === 0) {
    throw new CliError("--recent requires -a <name>");
  }

  if (interactiveProperties && (additionalProperties.length > 0 || allProperties)) {
    throw new CliError("-i/--interactive cannot be combined with -p or --all-props");
  }

  if (interactiveProperties && appNames.length > 0) {
    throw new CliError("-i/--interactive requires an input file");
  }

  return {
    inputFile,
    appNames,
    additionalProperties,
    filterAst,
    csvOutput,
    allProperties,
    interactiveProperties,
    recent,
  };
}

export function buildHelpText() {
  return [
    "Usage: cflogs (<input-file> | -a <name>) [-p prop1,prop2] [--all-props] [-i] [-f <expr>] [--recent] [--csv]",
    "",
    "Input:",
    "  <input-file>      Transform a captured log file (prints a JSON array).",
    "  -a <name>      Run `cf logs <name>` and stream it as NDJSON.",
    "                    Repeatable or comma-separated to merge multiple apps",
    "                    into one stream (adds a synthetic 'app' column).",
    "  --recent         Pass through to `cf logs --recent` (no streaming).",
    "",
    "  -p <prop,...>    Include comma-separated additional properties.",
    "  --all-props       Include every property, after default properties and app.",
    "  -i, --interactive Select properties found in an input file interactively.",
    "  -f <expr>         Filter log entries using an expression.",
    "  --csv             Output as CSV instead of JSON.",
    "",
    "Filter expression operators:",
    "  =  >  <  contains  startswith  endswith",
    "  Combine with: and  or  ( )",
    "",
    "Examples:",
    "  cflogs logs.json -p thread,request_id",
    "  cflogs logs.json --all-props",
    "  cflogs logs.json --interactive",
    "  cflogs logs.json -f \"logger = 'myapp'\"",
    "  cflogs logs.json -f \"logger = '4' or logger = '10'\"",
    "  cflogs logs.json -f \"(logger = '4' or msg contains '40') and correlation_id = '439034'\"",
    "  cflogs logs.json --csv",
    "  cflogs -a my-app -f \"level = 'ERROR'\"",
    "  cflogs -a my-app --recent",
    "  cflogs -a app1,app2 -f \"level = 'ERROR'\"",
  ].join("\n");
}
