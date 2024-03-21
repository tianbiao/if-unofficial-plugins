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

export type GcpVmInstanceOutputs = {
  zone: string;
  instanceName: string;
  instanceId: string;
  machineType: string;
  cpuPlatform: string;
};

export type GcpMetricsOutputs = {
  instanceName: string;
  instanceId: string;
  zone: string;
  metricsType: string;
  startTime: number;
  endTime: number;
  value: number;
};

export type GcpVmUsageOutputs = {
  instanceName: string;
  instanceId: string;
  zone: string;
  metricsType: string;
  startTime: number;
  endTime: number;
  ramTotal: number;
  ramUsed: number;
  cpuUtilization: number;
};
