// Shared storage for Copyleaks export data
// In production, this should be replaced with a proper database

export const exportedData = new Map<string, any>();

export function storeExportedData(key: string, data: any) {
  exportedData.set(key, data);
}

export function getExportedData(key: string) {
  return exportedData.get(key);
}

export function getAllExportedData() {
  return exportedData;
}
