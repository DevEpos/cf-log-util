import { readFileSync } from "node:fs";
import { evalFilterNode } from "./filter.js";

// ---------------------------------------------------------------------------
// Log processing helpers
// ---------------------------------------------------------------------------

export function extractJsonPart(line) {
  const markerIndex = line.indexOf("{");

  if (markerIndex < 0) {
    return null;
  }

  let payload = line.slice(markerIndex).trim();

  if (!payload.startsWith("{")) {
    return null;
  }

  if (payload.endsWith(",")) {
    payload = payload.slice(0, -1);
  }

  return payload;
}

export function transformLine(line, orderedProperties, filterAst, appTag, allProperties) {
  const jsonPayload = extractJsonPart(line);

  if (!jsonPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonPayload);

    if (appTag !== undefined) {
      parsed.app = appTag;
    }

    if (filterAst && !evalFilterNode(filterAst, parsed)) {
      return null;
    }

    return createOutputRow(parsed, orderedProperties, allProperties);
  } catch {
    // Ignore non-JSON log lines.
    return null;
  }
}

export function createOutputRow(source, orderedProperties, allProperties) {
  const row = {};

  for (const property of orderedProperties) {
    if (Object.hasOwn(source, property)) {
      row[property] = source[property];
    }
  }

  if (allProperties) {
    for (const property of Object.keys(source)) {
      if (!Object.hasOwn(row, property)) {
        row[property] = source[property];
      }
    }
  }

  return row;
}

export function discoverFileProperties(inputFile) {
  const discoveredProperties = [];
  const knownProperties = new Set();

  for (const line of readFileSync(inputFile, "utf8").split(/\r?\n/)) {
    const jsonPayload = extractJsonPart(line);
    if (!jsonPayload) continue;

    try {
      const record = JSON.parse(jsonPayload);
      for (const property of Object.keys(record)) {
        if (!knownProperties.has(property)) {
          knownProperties.add(property);
          discoveredProperties.push(property);
        }
      }
    } catch {
      // Ignore non-JSON log lines.
    }
  }

  return discoveredProperties;
}
