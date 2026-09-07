import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { escapeCsvField, formatCsvRow, expandPropertiesForRows, outputJson, outputCsv } from "../src/lib/output.js";

describe("escapeCsvField", () => {
  test("returns empty string for null/undefined", () => {
    assert.equal(escapeCsvField(null), "");
    assert.equal(escapeCsvField(undefined), "");
  });

  test("quotes fields containing commas, quotes or newlines", () => {
    assert.equal(escapeCsvField("a,b"), '"a,b"');
    assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""');
    assert.equal(escapeCsvField("line1\nline2"), '"line1\nline2"');
  });

  test("stringifies objects as JSON, quoted since JSON contains double quotes", () => {
    assert.equal(escapeCsvField({ a: 1 }), '"{""a"":1}"');
  });

  test("leaves plain strings untouched", () => {
    assert.equal(escapeCsvField("plain"), "plain");
  });
});

describe("formatCsvRow", () => {
  test("joins fields in property order", () => {
    assert.equal(formatCsvRow({ a: "1", b: "2" }, ["b", "a"]), "2,1");
  });
});

describe("expandPropertiesForRows", () => {
  test("appends properties discovered in rows not already present", () => {
    const expanded = expandPropertiesForRows(["a"], [{ a: 1, b: 2 }, { c: 3 }]);
    assert.deepEqual(expanded, ["a", "b", "c"]);
  });
});

describe("output writers", () => {
  function captureStdout(fn) {
    const chunks = [];
    const original = process.stdout.write;
    process.stdout.write = (chunk) => {
      chunks.push(chunk);
      return true;
    };
    try {
      fn();
    } finally {
      process.stdout.write = original;
    }
    return chunks.join("");
  }

  test("outputJson prints a JSON array", () => {
    const out = captureStdout(() => outputJson([{ a: 1 }, { a: 2 }]));
    assert.equal(out, '[\n{"a":1},\n{"a":2}\n]\n');
  });

  test("outputCsv prints a header row followed by data rows", () => {
    const out = captureStdout(() => outputCsv([{ a: "1", b: "2" }], ["a", "b"]));
    assert.equal(out, "a,b\n1,2\n");
  });
});
