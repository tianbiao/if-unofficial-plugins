export type GcpOutputs = {
  timestamps: string[];
  cpuUtilizations: string[];
  memAvailable: string[];
};

export type GcpInputs = {
  vmName: string;
  timespan: string;
  timestamp: string;
  duration: string;
};

export type GetMetricsParams = {
  timespan: string;
  vmName: string;
};

export type GcpMetadataOutputs = {
  location: string;
  instanceType: string;
  totalMemoryGB: string;
};
