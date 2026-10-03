"use strict";
export function formatEnvValueForDotfile(value) {
  let formatted = value, warning = void 0;
  const containsNewline = value.includes("\n");
  const containsSingleQuote = value.includes("'");
  const containsDoubleQuote = value.includes('"');
  const containsSlashN = value.includes("\\n");
  const commentWarning = value.includes("#") && `includes a '#' which may be interpreted as a comment if you save this value to a .env file, resulting in only reading a partial value.`;
  if (containsNewline) {
    if (!containsSingleQuote) {
      formatted = `'${value}'`;
    } else if (!containsSlashN) {
      if (containsDoubleQuote && commentWarning) {
        warning = commentWarning;
      }
      formatted = `"${value.replaceAll("\n", "\\n")}"`;
    } else {
      formatted = `'${value}'`;
      warning = `includes single quotes, newlines and "\\n" in the value. If you save this value to a .env file, it may not round-trip.`;
    }
  } else if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'") || value.startsWith("`") || value.endsWith("`") || value.includes("\f") || value.includes("\v") || commentWarning) {
    if (containsSingleQuote && !containsDoubleQuote && !containsSlashN) {
      formatted = `"${value}"`;
    } else {
      formatted = `'${value}'`;
      if (containsSingleQuote && commentWarning) {
        warning = commentWarning;
      }
    }
  }
  if (value.includes("\r")) {
    warning = warning ? `${warning} It also ` : "";
    warning += `includes carriage return (\\r) which cannot be preserved in .env files (dotenv limitation)`;
  }
  return { formatted, warning };
}
//# sourceMappingURL=formatEnvValueForDotfile.js.map
