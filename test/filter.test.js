import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseFilterExpr, evalFilterNode } from "../src/lib/filter.js";

describe("parseFilterExpr", () => {
  test("parses a simple comparison", () => {
    const ast = parseFilterExpr("level = 'ERROR'");
    assert.deepEqual(ast, { type: "comparison", field: "level", op: "=", value: "ERROR" });
  });

  test("parses and/or with correct precedence (and binds tighter than or)", () => {
    const ast = parseFilterExpr("a = '1' or b = '2' and c = '3'");
    assert.equal(ast.type, "or");
    assert.equal(ast.left.type, "comparison");
    assert.equal(ast.right.type, "and");
  });

  test("parses parenthesized expressions", () => {
    const ast = parseFilterExpr("(a = '1' or b = '2') and c = '3'");
    assert.equal(ast.type, "and");
    assert.equal(ast.left.type, "or");
  });

  test("supports contains/startswith/endswith operators", () => {
    for (const op of ["contains", "startswith", "endswith"]) {
      const ast = parseFilterExpr(`msg ${op} 'foo'`);
      assert.equal(ast.op, op);
    }
  });

  test("throws on unterminated string literal", () => {
    assert.throws(() => parseFilterExpr("level = 'ERROR"), /Unterminated string literal/);
  });

  test("throws on unexpected trailing token", () => {
    assert.throws(() => parseFilterExpr("level = 'ERROR' foo"), /Unexpected token/);
  });

  test("throws on unknown character", () => {
    assert.throws(() => parseFilterExpr("level = 'ERROR' & other = '1'"), /Unexpected character/);
  });
});

describe("evalFilterNode", () => {
  test("= operator matches string equality", () => {
    const ast = parseFilterExpr("level = 'ERROR'");
    assert.equal(evalFilterNode(ast, { level: "ERROR" }), true);
    assert.equal(evalFilterNode(ast, { level: "INFO" }), false);
  });

  test("> and < operators compare numerically", () => {
    assert.equal(evalFilterNode(parseFilterExpr("count > '5'"), { count: 10 }), true);
    assert.equal(evalFilterNode(parseFilterExpr("count < '5'"), { count: 10 }), false);
  });

  test("contains/startswith/endswith are case-insensitive", () => {
    const record = { msg: "Something Failed" };
    assert.equal(evalFilterNode(parseFilterExpr("msg contains 'failed'"), record), true);
    assert.equal(evalFilterNode(parseFilterExpr("msg startswith 'something'"), record), true);
    assert.equal(evalFilterNode(parseFilterExpr("msg endswith 'FAILED'"), record), true);
  });

  test("missing field is treated as empty string", () => {
    assert.equal(evalFilterNode(parseFilterExpr("missing = ''"), {}), true);
  });

  test("and/or combine child results", () => {
    const record = { a: "1", b: "2" };
    assert.equal(evalFilterNode(parseFilterExpr("a = '1' and b = '2'"), record), true);
    assert.equal(evalFilterNode(parseFilterExpr("a = '1' and b = '3'"), record), false);
    assert.equal(evalFilterNode(parseFilterExpr("a = '9' or b = '2'"), record), true);
  });
});
