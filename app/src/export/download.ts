/** Tải một Blob xuống máy người dùng. Chỉ chạy ở trình duyệt; không gửi dữ liệu đi đâu. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const downloadCsv = (filename: string, csv: string) => downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }));

export const downloadXlsx = (filename: string, buffer: ArrayBuffer | Uint8Array) =>
  downloadBlob(filename, new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));

/** Tên file an toàn, có ngày: smartspend-<tên>-YYYYMMDD.<đuôi>. */
export function exportFilename(name: string, today: string, ext: 'csv' | 'xlsx'): string {
  return `smartspend-${name}-${today.replace(/-/g, '')}.${ext}`;
}
