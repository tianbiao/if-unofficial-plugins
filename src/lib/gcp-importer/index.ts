import * as dotenv from 'dotenv';
import {z} from 'zod';

import {PluginInterface} from '../../interfaces';
import {ConfigParams, PluginParams} from '../../types/common';

import {allDefined, validate} from '../../util/validations';
import {buildErrorMessage} from '../../util/helpers';
import {ERRORS} from '../../util/errors';

import {
  GcpInputs,
  GcpOutputs,
  GetMetricsParams,
  GcpMetadataOutputs,
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
      const rawResults = await getVmUsage(gcpInput);
      const rawMetadataResults = await getInstanceMetadata();
      mergedWithConfig['duration'] = 60; //Compute Engine metrics are collected every minute

      enrichedOutputsArray = enrichOutputs(
        rawResults,
        rawMetadataResults,
        mergedWithConfig
      );
    }

    return enrichedOutputsArray.flat();
  };

  /**
   * Enriches the raw output and metadata results with additional information
   * and maps them to a new structure based on the PluginParams input.
   */
  const enrichOutputs = (
    rawResults: GcpOutputs,
    rawMetadataResults: GcpMetadataOutputs,
    input: PluginParams
  ) => {
    return rawResults.timestamps.map((timestamp, index) => ({
      'cloud/vendor': 'gcp',
      'cpu/utilization': rawResults.cpuUtilizations[index],
      'memory/available/GB': parseFloat(rawResults.memAvailable[index]) * 1e-9,
      'memory/used/GB':
        parseFloat(rawMetadataResults.totalMemoryGB) -
        parseFloat(rawResults.memAvailable[index]) * 1e-9,
      'memory/capacity/GB': rawMetadataResults.totalMemoryGB,
      'memory/utilization':
        ((parseFloat(rawMetadataResults.totalMemoryGB) -
          parseFloat(rawResults.memAvailable[index]) * 1e-9) /
          parseFloat(rawMetadataResults.totalMemoryGB)) *
        100,
      location: rawMetadataResults.location,
      'cloud/instance-type': rawMetadataResults.instanceType,
      ...input,
      timestamp,
    }));
  };

  /**
   * Maps PluginParams input to AzureInputs structure for Azure-specific queries.
   */
  const mapInputToGcpInputs = (input: PluginParams): GcpInputs => {
    return {
      vmName: input['gcp-vm-name'],
      timestamp: input['timestamp']!,
      duration: input['duration'].toString(),
      timespan: getTimeSpan(input['duration'], input['timestamp']!),
    };
  };

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
   * Retrieves virtual machine usage metrics from Azure based on the provided AzureInputs.
   */
  const getVmUsage = async (metricParams: GcpInputs): Promise<GcpOutputs> => {
    const timestamps: string[] = [];
    const cpuUtils: string[] = [];
    const memAvailable: string[] = [];

    // Helper function to parse metric data and populate metricArray and timestamps.
    const parseMetrics = async (
      timeSeriesData: Promise<any[]>,
      metricArray: string[],
      metricName: string
    ) => {
      for (const data of (await timeSeriesData) ?? []) {
        if (typeof data.average !== 'undefined') {
          metricArray.push(data.average.toString());
          if (metricName === 'cpuUtilizations') {
            timestamps.push(data.timeStamp.toISOString());
          }
        }
      }
    };

    parseMetrics(getCPUMetrics(metricParams), cpuUtils, 'cpuUtilizations');
    parseMetrics(getRawTotalMetrics(metricParams), memAvailable, '');
    parseMetrics(getRawUsedMetrics(metricParams), memAvailable, '');

    return {timestamps, cpuUtilizations: cpuUtils, memAvailable};
  };

  /**
   * Gets CPU metrics by calling monitor client.
   */
  const getCPUMetrics = async (metricParams: GetMetricsParams) => {
    return gcpAPI.getMetricsTimeseries(metricParams, 'cpu/utilization');
  };

  /**
   * Gets RAW Total metrics by calling monitor client.
   */
  const getRawTotalMetrics = async (metricParams: GetMetricsParams) => {
    return gcpAPI.getMetricsTimeseries(
      metricParams,
      'instance/memory/balloon/ram_size'
    );
  };

  /**
   * Gets RAW Used metrics by calling monitor client.
   */
  const getRawUsedMetrics = async (metricParams: GetMetricsParams) => {
    return gcpAPI.getMetricsTimeseries(
      metricParams,
      'instance/memory/balloon/ram_used'
    );
  };

  /**
   * Takes manifest `timestamp` and `duration` and returns an Azure formatted `timespan` value.
   */
  const getTimeSpan = (duration: number, timestamp: string): string => {
    const start = new Date(timestamp);
    const end = new Date(start.getTime() + duration * 1000);

    return `${start.toISOString()}/${end.toISOString()}`;
  };

  /**
   * Gathers instance metadata.
   */
  const getInstanceMetadata = async (): Promise<GcpMetadataOutputs> => {
    return {
      location: 'location',
      instanceType: 'instanceType',
      totalMemoryGB: 'totalMemoryGB',
    };
  };

  /**
   * Calculates number of seconds covered by each individual input using `azure-time-window` value
   */
  // const calculateDurationPerInput = (azureInputs: AzureInputs): number => {
  //   const [value, unit] = azureInputs.window.split(' ', 2);
  //
  //   return parseFloat(value) * (TIME_UNITS_IN_SECONDS[unit.toLowerCase()] || 0);
  // };

  return {
    metadata,
    execute,
  };
};
