export interface PointCloudData {
  positions: Float32Array;
  colors: Float32Array;
  width: number;
  height: number;
}

export enum AppState {
  IDLE = 'IDLE',
  GENERATING_DEPTH = 'GENERATING_DEPTH',
  PROCESSING_POINTS = 'PROCESSING_POINTS',
  VIEWING = 'VIEWING',
  ERROR = 'ERROR'
}

export interface ProcessingConfig {
  sampleRate: number; // 1 = every pixel, 2 = every 2nd pixel, etc.
  depthScale: number; // Multiplier for Z axis
  pointSize: number;
}
