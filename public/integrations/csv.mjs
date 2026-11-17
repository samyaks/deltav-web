// A small CSV reader. Fields may be quoted, and a quoted field may contain a comma.

export function parseCsv(text) {
  const table = parseTable(String(text).replace(/^\uFEFF/, ""));
  if (table.length === 0 || table[0].every((cell) => cell.trim() === "")) {
    throw new Error("CSV needs a header row.");
  }
  const headers = table[0].map((cell) => cell.trim());
  if (headers.some((header) => header === "")) {
    throw new Error("CSV header has an empty column.");
  }
  const seen = new Set();
  for (const header of headers) {
    if (seen.has(header)) throw new Error(`CSV header repeats "${header}".`);
    seen.add(header);
  }
  const records = [];
  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    if (cells.length === 1 && cells[0].trim() === "") continue;
    if (cells.length !== headers.length) {
      throw new Error(`CSV row ${i + 1} has ${cells.length} columns. The header has ${headers.length}.`);
    }
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index].trim();
    });
    records.push(record);
  }
  return { headers, records };
}

export function expectHeaders(actual, expected, label) {
  const same = actual.length === expected.length && actual.every((header, index) => header === expected[index]);
  if (!same) {
    throw new Error(`${label} header must be ${expected.join(",")}.`);
  }
}

function parseTable(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (quoted) throw new Error("CSV has a quote that never closes.");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
