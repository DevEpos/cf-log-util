// ---------------------------------------------------------------------------
// Output formatters
// ---------------------------------------------------------------------------

export function escapeCsvField(value) {
  if (value === undefined || value === null) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatCsvRow(row, orderedProperties) {
  return orderedProperties.map((p) => escapeCsvField(row[p])).join(",");
}

export function outputCsv(rows, orderedProperties) {
  process.stdout.write(orderedProperties.join(",") + "\n");
  for (const row of rows) {
    process.stdout.write(formatCsvRow(row, orderedProperties) + "\n");
  }
}

export function expandPropertiesForRows(orderedProperties, rows) {
  const expandedProperties = [...orderedProperties];

  for (const row of rows) {
    for (const property of Object.keys(row)) {
      if (!expandedProperties.includes(property)) {
        expandedProperties.push(property);
      }
    }
  }

  return expandedProperties;
}

export function outputJson(rows) {
  process.stdout.write("[\n");
  rows.forEach((row, index) => {
    const suffix = index === rows.length - 1 ? "" : ",";
    process.stdout.write(`${JSON.stringify(row)}${suffix}\n`);
  });
  process.stdout.write("]\n");
}
