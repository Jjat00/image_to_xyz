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

export enum DepthModel {
  DEPTH_ANYTHING_V2 = 'depth-anything-v2',
  LOCAL_SERVER = 'local-server',
  HUGGINGFACE = 'huggingface',
  OPENAI = 'openai'
}

export interface ProcessingConfig {
  sampleRate: number; // 1 = every pixel, 2 = every 2nd pixel, etc.
  depthScale: number; // Multiplier for Z axis
  pointSize: number;
  depthModel: DepthModel; // Model to use for depth estimation
}
