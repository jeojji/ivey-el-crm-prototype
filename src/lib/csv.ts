// CSV reading and writing (RFC 4180). Runs entirely in the browser; nothing is uploaded.

/** Parses CSV text into rows of cells. Handles quotes, escaped quotes, commas/newlines in quotes, CRLF and a BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Drop fully blank lines (e.g. a trailing newline or empty rows Excel leaves behind).
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/**
 * Spreadsheet apps treat cells starting with = + - @ as formulas. Exported text that could be
 * misread that way gets a leading apostrophe. Phone numbers like "+1-519-555-0100" are left alone.
 */
function protectFormula(value: string): string {
  if (/^[=@\t\r]/.test(value)) return `'${value}`;
  if (/^[+-]/.test(value) && !/^[+-][\d\s().-]*$/.test(value)) return `'${value}`;
  return value;
}

/** Reverses protectFormula when a file this app exported is imported again. */
export function unprotectFormula(value: string): string {
  return /^'[=@+\-\t\r]/.test(value) ? value.slice(1) : value;
}

function quote(value: string): string {
  const v = protectFormula(value);
  return /[",\r\n]/.test(v) || v !== v.trim() ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Builds CSV text with CRLF line endings and a BOM so Excel opens accented characters correctly. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers, ...rows].map((r) => r.map((c) => quote(c == null ? '' : String(c))).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Reads a File as text, falling back to Windows-1252 when the file isn't valid UTF-8 (older Excel exports). */
export async function readFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}
