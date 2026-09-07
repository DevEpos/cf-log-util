import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extractJsonPart, transformLine, discoverFileProperties } from "../src/lib/log-processing.js";
import { parseFilterExpr } from "../src/lib/filter.js";

const fixtureFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "sample.log");

describe("extractJsonPart", () => {
  test("extracts the JSON payload after the cf logs prefix", () => {
    assert.equal(extractJsonPart('prefix {"a":1}'), '{"a":1}');
  });

  test("returns null when no JSON object is present", () => {
    assert.equal(extractJsonPart("plain text line"), null);
  });

  test("strips a trailing comma", () => {
    assert.equal(extractJsonPart('{"a":1},'), '{"a":1}');
  });
});

describe("transformLine", () => {
  const line = '2026-09-07 [APP] OUT {"logger":"myapp","level":"ERROR","msg":"boom"}';

  test("projects only the ordered properties", () => {
    const row = transformLine(line, ["logger", "level"], null, undefined, false);
    assert.deepEqual(row, { logger: "myapp", level: "ERROR" });
  });

  test("tags the record with the app name when provided", () => {
    const row = transformLine(line, ["logger", "app"], null, "my-app", false);
    assert.deepEqual(row, { logger: "myapp", app: "my-app" });
  });

  test("applies the filter AST and returns null when it does not match", () => {
    const filterAst = parseFilterExpr("level = 'INFO'");
    assert.equal(transformLine(line, ["logger"], filterAst, undefined, false), null);
  });

  test("includes all properties when allProperties is true", () => {
    const row = transformLine(line, ["logger"], null, undefined, true);
    assert.deepEqual(row, { logger: "myapp", level: "ERROR", msg: "boom" });
  });

  test("returns null for non-JSON lines", () => {
    assert.equal(transformLine("no json here", ["logger"], null, undefined, false), null);
  });
});

describe("discoverFileProperties", () => {
  test("collects unique property names in first-seen order from a log file", () => {
    const properties = discoverFileProperties(fixtureFile);
    assert.deepEqual(properties, [
      "logger",
      "timestamp",
      "level",
      "correlation_id",
      "msg",
      "thread",
      "stacktrace",
    ]);
  });
});
