import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/lib/args.js";
import { CliError } from "../src/lib/cli-error.js";

describe("parseArgs", () => {
  test("throws help CliError with exit code 1 when no args given", () => {
    assert.throws(
      () => parseArgs([]),
      (error) => error instanceof CliError && error.exitCode === 1 && !!error.helpText,
    );
  });

  test("throws help CliError with exit code 0 for --help", () => {
    assert.throws(
      () => parseArgs(["--help"]),
      (error) => error instanceof CliError && error.exitCode === 0 && !!error.helpText,
    );
  });

  test("parses an input file with default properties", () => {
    const result = parseArgs(["logs.json"]);
    assert.equal(result.inputFile, "logs.json");
    assert.deepEqual(result.appNames, []);
  });

  test("parses -p as comma-separated additional properties", () => {
    const result = parseArgs(["logs.json", "-p", "thread,request_id"]);
    assert.deepEqual(result.additionalProperties, ["thread", "request_id"]);
  });

  test("parses -a with multiple comma-separated app names", () => {
    const result = parseArgs(["-a", "app1,app2"]);
    assert.deepEqual(result.appNames, ["app1", "app2"]);
    assert.equal(result.inputFile, null);
  });

  test("parses --csv and --all-props flags", () => {
    const result = parseArgs(["logs.json", "--csv", "--all-props"]);
    assert.equal(result.csvOutput, true);
    assert.equal(result.allProperties, true);
  });

  test("parses -f into a filter AST", () => {
    const result = parseArgs(["logs.json", "-f", "level = 'ERROR'"]);
    assert.equal(result.filterAst.type, "comparison");
  });

  test("rejects -a combined with an input file", () => {
    assert.throws(() => parseArgs(["logs.json", "-a", "app1"]), CliError);
  });

  test("rejects --recent without -a", () => {
    assert.throws(() => parseArgs(["logs.json", "--recent"]), CliError);
  });

  test("rejects -i combined with -p", () => {
    assert.throws(() => parseArgs(["logs.json", "-i", "-p", "thread"]), CliError);
  });

  test("rejects -i combined with -a", () => {
    assert.throws(() => parseArgs(["-a", "app1", "-i"]), CliError);
  });

  test("rejects invalid -f expression", () => {
    assert.throws(() => parseArgs(["logs.json", "-f", "level = "]), /Invalid -f expression/);
  });

  test("rejects unexpected extra argument", () => {
    assert.throws(() => parseArgs(["logs.json", "extra.json"]), /Unexpected argument/);
  });
});
