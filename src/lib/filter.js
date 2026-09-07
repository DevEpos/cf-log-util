// ---------------------------------------------------------------------------
// Filter expression parser
//
// Grammar (case-insensitive keywords):
//   expr     = or_expr
//   or_expr  = and_expr  ( 'or'  and_expr )*
//   and_expr = primary   ( 'and' primary  )*
//   primary  = '(' expr ')' | comparison
//   comparison = field operator value
//   field    = /[a-z_][a-z0-9_]*/i
//   operator = '=' | '>' | '<' | 'contains' | 'startswith' | 'endswith'
//   value    = single-quoted string | unquoted token
// ---------------------------------------------------------------------------

export function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    // skip whitespace
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    // parentheses
    if (input[i] === "(" || input[i] === ")") {
      tokens.push({ type: input[i], value: input[i] });
      i++;
      continue;
    }

    // single-quoted string
    if (input[i] === "'") {
      let str = "";
      i++;
      while (i < input.length && input[i] !== "'") {
        if (input[i] === "\\" && i + 1 < input.length) {
          i++;
          str += input[i];
        } else {
          str += input[i];
        }
        i++;
      }
      if (input[i] !== "'") throw new Error("Unterminated string literal");
      i++;
      tokens.push({ type: "string", value: str });
      continue;
    }

    // operators = < >
    if (input[i] === "=" || input[i] === "<" || input[i] === ">") {
      tokens.push({ type: "op", value: input[i] });
      i++;
      continue;
    }

    // identifiers / keywords
    if (/[a-z_]/i.test(input[i])) {
      let word = "";
      while (i < input.length && /[a-z0-9_]/i.test(input[i])) {
        word += input[i++];
      }
      const lower = word.toLowerCase();
      if (lower === "and" || lower === "or") {
        tokens.push({ type: lower, value: lower });
      } else if (["contains", "startswith", "endswith"].includes(lower)) {
        tokens.push({ type: "op", value: lower });
      } else {
        tokens.push({ type: "ident", value: word });
      }
      continue;
    }

    throw new Error(`Unexpected character: ${input[i]}`);
  }

  tokens.push({ type: "eof" });
  return tokens;
}

export function parseFilterExpr(input) {
  const tokens = tokenize(input);
  let pos = 0;

  function peek() {
    return tokens[pos];
  }
  function consume(type) {
    const t = tokens[pos];
    if (type && t.type !== type) {
      throw new Error(`Expected ${type} but got ${t.type} ("${t.value ?? ""}")`);
    }
    pos++;
    return t;
  }

  function parseExpr() {
    return parseOrExpr();
  }

  function parseOrExpr() {
    let left = parseAndExpr();
    while (peek().type === "or") {
      consume("or");
      const right = parseAndExpr();
      left = { type: "or", left, right };
    }
    return left;
  }

  function parseAndExpr() {
    let left = parsePrimary();
    while (peek().type === "and") {
      consume("and");
      const right = parsePrimary();
      left = { type: "and", left, right };
    }
    return left;
  }

  function parsePrimary() {
    if (peek().type === "(") {
      consume("(");
      const node = parseExpr();
      consume(")");
      return node;
    }
    return parseComparison();
  }

  function parseComparison() {
    const field = consume("ident").value;
    const op = consume("op").value;
    const valueTok = peek();
    if (valueTok.type !== "string" && valueTok.type !== "ident") {
      throw new Error(`Expected value after operator, got ${valueTok.type}`);
    }
    const value = consume().value;
    return { type: "comparison", field, op, value };
  }

  const ast = parseExpr();
  if (peek().type !== "eof") {
    throw new Error(`Unexpected token: "${peek().value}" at position ${pos}`);
  }
  return ast;
}

export function evalFilterNode(node, record) {
  switch (node.type) {
    case "and":
      return evalFilterNode(node.left, record) && evalFilterNode(node.right, record);
    case "or":
      return evalFilterNode(node.left, record) || evalFilterNode(node.right, record);
    case "comparison": {
      const fieldVal = record[node.field];
      const str = fieldVal === undefined || fieldVal === null ? "" : String(fieldVal);
      const cmp = node.value;
      switch (node.op) {
        case "=":          return str === cmp;
        case ">":          return Number(str) > Number(cmp);
        case "<":          return Number(str) < Number(cmp);
        case "contains":   return str.toLowerCase().includes(cmp.toLowerCase());
        case "startswith": return str.toLowerCase().startsWith(cmp.toLowerCase());
        case "endswith":   return str.toLowerCase().endsWith(cmp.toLowerCase());
        default:
          throw new Error(`Unknown operator: ${node.op}`);
      }
    }
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}
