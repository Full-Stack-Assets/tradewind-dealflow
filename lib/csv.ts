export const MAX_CSV_BYTES = 1024 * 1024;
export const MAX_CSV_DATA_ROWS = 500;
export const MAX_CSV_COLUMNS = 30;
export const MAX_CSV_FIELD_LENGTH = 10_000;
export const MAX_CSV_TOTAL_CHARACTERS = 1_000_000;

export type CsvParseResult =
  | { ok: true; rows: string[][] }
  | { ok: false; errors: string[] };

export function decodeCsvFile(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_CSV_BYTES) {
    throw new Error("CSV files must be no larger than one MiB.");
  }
  if (hasMultipleLeadingUtf8Boms(bytes)) {
    throw new Error("CSV contains more than one leading UTF-8 BOM.");
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("CSV file is not valid UTF-8.");
  }
}

export function parseCsv(input: string): CsvParseResult {
  const bomCount = leadingBomCount(input);
  if (bomCount > 1) return failure("CSV contains more than one leading UTF-8 BOM.");
  const text = bomCount === 1 ? input.slice(1) : input;
  const characters = Array.from(text);
  if (characters.length > MAX_CSV_TOTAL_CHARACTERS) {
    return failure("CSV exceeds the maximum aggregate decoded character limit.");
  }
  if (text === "") return { ok: true, rows: [] };

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let fieldCharacterCount = 0;
  let inQuotes = false;
  let afterQuote = false;

  const append = (value: string): CsvParseResult | null => {
    field += value;
    fieldCharacterCount += 1;
    if (fieldCharacterCount > MAX_CSV_FIELD_LENGTH) {
      return failure("CSV field exceeds the maximum decoded field length.");
    }
    return null;
  };

  const finishRow = (): CsvParseResult | null => {
    row.push(field);
    if (row.length > MAX_CSV_COLUMNS) {
      return failure("CSV exceeds the maximum number of columns.");
    }
    if (rows.length >= MAX_CSV_DATA_ROWS + 1) {
      return failure("CSV exceeds the maximum number of data rows.");
    }
    rows.push(row);
    row = [];
    field = "";
    fieldCharacterCount = 0;
    afterQuote = false;
    return null;
  };

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index] as string;
    if (inQuotes) {
      if (character === '"') {
        if (characters[index + 1] === '"') {
          const error = append('"');
          if (error) return error;
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else if (character === "\r") {
        const error = append("\n");
        if (error) return error;
        if (characters[index + 1] === "\n") index += 1;
      } else {
        const error = append(character);
        if (error) return error;
      }
      continue;
    }

    if (afterQuote) {
      if (character === ",") {
        row.push(field);
        if (row.length >= MAX_CSV_COLUMNS) {
          return failure("CSV exceeds the maximum number of columns.");
        }
        field = "";
        fieldCharacterCount = 0;
        afterQuote = false;
      } else if (character === "\n" || character === "\r") {
        const error = finishRow();
        if (error) return error;
        if (character === "\r" && characters[index + 1] === "\n") index += 1;
      } else {
        return failure("CSV contains characters after a closing quote.");
      }
      continue;
    }

    if (character === '"') {
      if (field !== "") return failure("CSV contains a quote in an unquoted field.");
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      if (row.length >= MAX_CSV_COLUMNS) {
        return failure("CSV exceeds the maximum number of columns.");
      }
      field = "";
      fieldCharacterCount = 0;
    } else if (character === "\n" || character === "\r") {
      const error = finishRow();
      if (error) return error;
      if (character === "\r" && characters[index + 1] === "\n") index += 1;
    } else {
      const error = append(character);
      if (error) return error;
    }
  }

  if (inQuotes) return failure("CSV contains an unclosed quote.");
  if (field !== "" || row.length > 0 || afterQuote) {
    const error = finishRow();
    if (error) return error;
  }
  return { ok: true, rows };
}

function failure(error: string): CsvParseResult {
  return { ok: false, errors: [error] };
}

function hasMultipleLeadingUtf8Boms(bytes: Uint8Array): boolean {
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf &&
    bytes[3] === 0xef && bytes[4] === 0xbb && bytes[5] === 0xbf;
}

function leadingBomCount(value: string): number {
  let count = 0;
  while (value[count] === "\uFEFF") count += 1;
  return count;
}
