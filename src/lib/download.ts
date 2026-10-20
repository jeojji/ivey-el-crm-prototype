/** Saves text as a file in the user's Downloads folder (browser-only, nothing is uploaded). */
export function downloadTextFile(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function timestampForFilename(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
}
