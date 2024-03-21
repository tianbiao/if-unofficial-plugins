import * as dotenv from 'dotenv';
import {z} from 'zod';

import {PluginInterface} from '../../interfaces';
import {ConfigParams, PluginParams} from '../../types';

import {allDefined, validate} from '../../util/validations';
import {buildErrorMessage} from '../../util/helpers';
import {ERRORS} from '../../util/errors';

import {
  GcpInputs,
  GcpVmInstanceOutputs,
  GetMetricsParams,
  GcpVmUsageOutputs,
} from './types';
import {GcpAPI} from './gcp-api';

const {ConfigValidationError} = ERRORS;

export const GcpImporter = (): PluginInterface => {
  const metadata = {kind: 'execute'};
  const errorBuilder = buildErrorMessage(GcpImporter.name);
  const gcpAPI = new GcpAPI();

  /**
   * Executes the model for a list of input parameters.
   */
  const execute = async (inputs: PluginParams[], config?: ConfigParams) => {
    dotenv.config();

    const validatedConfig = validateConfig(config);
    let enrichedOutputsArray: PluginParams[] = [];

    for await (const input of inputs) {
      const mergedWithConfig = Object.assign(
        {},
        validateInput(input),
        validatedConfig
      );
      const gcpInput = mapInputToGcpInputs(mergedWithConfig);
      const vmInstancesResults: GcpVmInstanceOutputs[] =
        await getAllVmInstances(gcpInput.projectId);
      const vmUsageResults: GcpVmUsageOutputs[] = await getVmUsage(gcpInput);
      mergedWithConfig['duration'] = 60; //Compute Engine metrics are collected every minute

      enrichedOutputsArray = enrichOutputs(
        vmUsageResults,
        vmInstancesResults,
        mergedWithConfig
      );
    }

    return enrichedOutputsArray;
  };

  /**
   * Enriches the vm usage results and vm instance results with additional information
   * and maps them to a new structure based on the PluginParams input.
   */
  const enrichOutputs = (
    vmUsageResults: GcpVmUsageOutputs[],
    vmInstancesResults: GcpVmInstanceOutputs[],
    input: PluginParams
  ) => {
    return vmUsageResults.reduce(
      (output: PluginParams[], row: GcpVmUsageOutputs) => {
        const vmInstance: GcpVmInstanceOutputs | undefined =
          vmInstancesResults.find(
            instance => instance.instanceId === row.instanceId
          );

        if (vmInstance) {
          output.push({
            'cloud/vendor': 'gcp',
            'cloud/instance-type': vmInstance.machineType,
            'cloud/cpu-platform': vmInstance.cpuPlatform,
            'cloud/instance-name': vmInstance.instanceName,
            'cloud/instance-id': vmInstance.instanceId,
            'cloud/zone': vmInstance.zone,
            'cpu/utilization': row.cpuUtilization,
            'memory/total/GB': row.ramTotal * 1e-9,
            'memory/used/GB': row.ramUsed * 1e-9,
            'memory/utilization': (row.ramTotal - row.ramUsed) / row.ramTotal,
            ...input,
            timestamp: new Date(row.startTime * 1000).toISOString(),
          });
        }

        return output;
      },
      []
    );
  };

  /**
   * Maps PluginParams input to GcpInputs structure for Gcp-specific queries.
   */
  const mapInputToGcpInputs = (input: PluginParams): GcpInputs => {
    return {
      projectId: input['gcp-project-id']!,
      timestamp: input['timestamp']!,
      duration: input['duration']!,
    };
  };

  /**
   * Checks for required fields in config.
   */
  const validateConfig = (config?: ConfigParams) => {
    if (!config) {
      throw new ConfigValidationError(
        errorBuilder({message: 'Config must be provided.'})
      );
    }

    const schema = z
      .object({
        'gcp-project-id': z.string(),
      })
      .refine(allDefined, {
        message: 'All parameters should be present.',
      });

    return validate<z.infer<typeof schema>>(schema, config);
  };

  /**
   * Checks for required fields in input.
   */
  const validateInput = (input: PluginParams) => {
    const schema = z
      .object({
        timestamp: z.string().datetime(),
        duration: z.number(),
      })
      .refine(allDefined);

    return validate<z.infer<typeof schema>>(schema, input);
  };

  /**
   * Retrieves virtual machine usage metrics from GCP Monitoring based on the provided GcpInputs.
   */
  const getVmUsage = async (
    metricParams: GcpInputs
  ): Promise<GcpVmUsageOutputs[]> => {
    const cpuMetrics = await getCpuMetrics(metricParams);
    const ramTotalMetrics = await getRamTotalMetrics(metricParams);
    const ramUsedMetrics = await getRamUsedMetrics(metricParams);

    const vmUsageOutputs: GcpVmUsageOutputs[] = [];
    cpuMetrics.map(cpuData => {
      const ramTotal = ramTotalMetrics.find(
        ramTotalData =>
          ramTotalData.instanceId === cpuData.instanceId &&
          ramTotalData.startTime === cpuData.startTime &&
          ramTotalData.endTime === cpuData.endTime
      );

      const ramUsed = ramUsedMetrics.find(
        ramUsedData =>
          ramUsedData.instanceId === cpuData.instanceId &&
          ramUsedData.startTime === cpuData.startTime &&
          ramUsedData.endTime === cpuData.endTime
      );

      if (ramTotal && ramUsed) {
        vmUsageOutputs.push({
          ...cpuData,
          ramTotal: ramTotal.value,
          ramUsed: ramUsed.value,
          cpuUtilization: cpuData.value,
        });
      }
    });

    return vmUsageOutputs;
  };

  /**
   * Gets CPU metrics by calling GCP monitor client.
   */
  const getCpuMetrics = async (metricParams: GetMetricsParams) => {
    return gcpAPI.getMetricsTimeseries(
      metricParams,
      'instance/cpu/utilization'
    );
  };

  /**
   * Gets RAM Total metrics by calling GCP monitor client.
   */
  const getRamTotalMetrics = async (metricParams: GetMetricsParams) => {
    return gcpAPI.getMetricsTimeseries(
      metricParams,
      'instance/memory/balloon/ram_size'
    );
  };

  /**
   * Gets RAM Used metrics by calling GCP monitor client.
   */
  const getRamUsedMetrics = async (metricParams: GetMetricsParams) => {
    return gcpAPI.getMetricsTimeseries(
      metricParams,
      'instance/memory/balloon/ram_used'
    );
  };

  /**
   * Gets GCP compute engine instance metadata.
   */
  const getAllVmInstances = async (projectId: string) => {
    return gcpAPI.getAllComputeEngineInstances(projectId);
  };

  return {
    metadata,
    execute,
  };
};
