import * as dotenv from 'dotenv';
import {z} from 'zod';

import {PluginInterface} from '../../interfaces';
import {ConfigParams, PluginParams} from '../../types/common';

import {allDefined, validate} from '../../util/validations';
import {buildErrorMessage} from '../../util/helpers';
import {ERRORS} from '../../util/errors';

import {GcpInputs, GetMetricsParams} from './types';
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
      // const rawMetadataResults = await getInstanceMetadata();
      mergedWithConfig['duration'] = 60; //Compute Engine metrics are collected every minute

      enrichedOutputsArray = enrichOutputs(rawResults, mergedWithConfig);
    }

    console.log('enrichedOutputsArray: ', enrichedOutputsArray.length);

    return enrichedOutputsArray;
  };

  /**
   * Enriches the raw output and metadata results with additional information
   * and maps them to a new structure based on the PluginParams input.
   */
  const enrichOutputs = (rawResults: any, input: PluginParams) => {
    return rawResults.map((row: any) => ({
      ...row,
      ...input,
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
   * Retrieves virtual machine usage metrics from Azure based on the provided AzureInputs.
   */
  const getVmUsage = async (metricParams: GcpInputs): Promise<any[]> => {
    // parseMetrics(getRawTotalMetrics(metricParams), memAvailable, '');
    // parseMetrics(getRawUsedMetrics(metricParams), memAvailable, '');
    const cpuMetrics = await getCPUMetrics(metricParams);
    const ramTotalMetrics = await getRamTotalMetrics(metricParams);
    const ramUsedMetrics = await getRamUsedMetrics(metricParams);
    console.log('getVmUsage', cpuMetrics.length);

    return cpuMetrics.concat(ramTotalMetrics, ramUsedMetrics);
  };

  /**
   * Gets CPU metrics by calling monitor client.
   */
  const getCPUMetrics = async (metricParams: GetMetricsParams) => {
    return gcpAPI.getMetricsTimeseries(
      metricParams,
      'instance/cpu/utilization'
    );
  };

  /**
   * Gets RAM Total metrics by calling monitor client.
   */
  const getRamTotalMetrics = async (metricParams: GetMetricsParams) => {
    return gcpAPI.getMetricsTimeseries(
      metricParams,
      'instance/memory/balloon/ram_size'
    );
  };

  /**
   * Gets RAM Used metrics by calling monitor client.
   */
  const getRamUsedMetrics = async (metricParams: GetMetricsParams) => {
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
  // const getInstanceMetadata = async (): Promise<GcpMetadataOutputs> => {
  //   return {
  //     location: 'location',
  //     instanceType: 'instanceType',
  //     totalMemoryGB: 'totalMemoryGB',
  //   };
  // };

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
