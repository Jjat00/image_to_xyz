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
  LOCAL_SERVER = 'local-server',
  HUGGINGFACE = 'huggingface',
  OPENAI = 'openai'
}

export interface ProcessingConfig {
  sampleRate: number;
  depthScale: number;
  pointSize: number;
  depthModel: DepthModel;
}
