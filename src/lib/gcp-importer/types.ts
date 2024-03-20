export type GcpOutputs = {
  timestamps: string[];
  cpuUtilizations: string[];
  memAvailable: string[];
};

export type GcpInputs = {
  projectId: string;
  timestamp: string;
  duration: number;
};

export type GetMetricsParams = {
  projectId: string;
  timestamp: string;
  duration: number;
};

export type GcpMetadataOutputs = {
  location: string;
  instanceType: string;
  totalMemoryGB: string;
};
