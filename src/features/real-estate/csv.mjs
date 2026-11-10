// Bounded RFC 4180 CSV parser. Values are returned as text for explicit domain validation.
export function parsePropertyCsv(input) {
  if (typeof input !== "string" || input.length > 256000)
    throw new Error("CSV must be at most 256 KB.");
  const text = input.replace(/^\uFEFF/, "");
  let cell = "",
    row = [],
    rows = [],
    quoted = false,
    closed = false;
  const pushRow = () => {
    row.push(cell);
    if (row.some((c) => c.trim())) rows.push(row);
    cell = "";
    row = [];
    closed = false;
    if (rows.length > 201)
      throw new Error("Import at most 200 properties at a time.");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      closed = false;
      continue;
    }
    if (c === "\r" || c === "\n") {
      pushRow();
      if (c === "\r" && text[i + 1] === "\n") i++;
      continue;
    }
    if (closed) {
      if (c === " " || c === "\t") continue;
      throw new Error("Unexpected text after a quoted CSV field.");
    }
    if (c === '"') {
      if (cell !== "") throw new Error("Quote must start a CSV field.");
      quoted = true;
      continue;
    }
    cell += c;
  }
  if (quoted) throw new Error("A quoted CSV field was not closed.");
  if (cell || row.length || closed) pushRow();
  if (rows.length < 2)
    throw new Error("CSV must contain a header and at least one property.");
  const headers = rows[0].map((c) => c.trim().toLowerCase());
  const required = [
    "address",
    "region",
    "postal_code",
    "lot_acres",
    "zoning",
    "utilities",
    "road_access",
    "asking_price",
    "listing_status",
  ];
  if (
    headers.length !== required.length ||
    new Set(headers).size !== headers.length ||
    required.some((h) => !headers.includes(h))
  )
    throw new Error(
      "Use the columns in the sample CSV, with no duplicate or extra columns.",
    );
  return rows.slice(1).map((r, i) => {
    if (r.length !== headers.length)
      throw new Error(
        "CSV record " + (i + 2) + " has the wrong number of fields.",
      );
    return Object.fromEntries(headers.map((h, j) => [h, r[j].trim()]));
  });
}
