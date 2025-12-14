export enum ProcessingStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  ERROR = 'error'
}

export interface ExtractedTableData {
  headers: string[];
  rows: string[][];
  summary?: string;
}