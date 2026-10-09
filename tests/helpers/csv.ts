/** CSV exports may contain quoted newlines in JSON payload columns. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [], row: string[] = [];
  let value = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && character === ",") { row.push(value); value = ""; }
    else if (!quoted && character === "\n") { row.push(value); rows.push([...row]); row.length = 0; value = ""; }
    else value += character;
  }
  if (quoted) throw new Error("Unterminated quoted CSV field");
  if (row.length || value) { row.push(value); rows.push(row); }
  return rows;
}
