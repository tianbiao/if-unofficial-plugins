import {MetricServiceClient} from '@google-cloud/monitoring';
import compute from '@google-cloud/compute';
import {
  GcpMetricsOutputs,
  GcpVmInstanceOutputs,
  GetMetricsParams,
} from './types';

export class GcpAPI {
  /**
   * Fetches metrics for a specific metric type from a specific gcp project.
   */
  public async getMetricsTimeseries(
    params: GetMetricsParams,
    metricType: string
  ): Promise<GcpMetricsOutputs[]> {
    const monitorClient = new MetricServiceClient();
    const projectId = params.projectId;

    const request = {
      name: monitorClient.projectPath(projectId),
      filter: `metric.type="compute.googleapis.com/${metricType}"`,
      interval: {
        startTime: {
          seconds: new Date(params.timestamp).getTime() / 1000,
        },
        endTime: {
          seconds:
            new Date(params.timestamp).getTime() / 1000 + params.duration,
        },
      },
    };
    const [timeSeries] = await monitorClient.listTimeSeries(request);

    const instanceMetricArray: any[] = [];
    timeSeries.forEach(data => {
      const instanceName: any = data.metric?.labels?.instance_name;
      const metricsType: any = data.metric?.type;
      const instanceId: any = data.resource?.labels?.instance_id;
      const zone: any = data.resource?.labels?.zone;

      if (data && instanceId && data.points) {
        data.points.forEach(point => {
          instanceMetricArray.push({
            instanceName,
            instanceId,
            zone,
            metricsType,
            startTime: point.interval?.startTime?.seconds,
            endTime: point.interval?.endTime?.seconds,
            value: point.value?.doubleValue || point.value?.int64Value,
          });
        });
      }
    });

    return instanceMetricArray;
  }

  /**
   * Fetches all vm instance from a specific gcp project.
   */
  public async getAllComputeEngineInstances(
    projectId: string
  ): Promise<GcpVmInstanceOutputs[]> {
    const instancesClient = new compute.InstancesClient();

    const aggListRequest = instancesClient.aggregatedListAsync({
      project: projectId,
    });

    const instanceArray: any[] = [];
    for await (const [zone, instancesObject] of aggListRequest) {
      const instances = instancesObject.instances;

      if (instances && instances.length > 0) {
        for (const instance of instances) {
          instanceArray.push({
            zone,
            instanceName: instance.name,
            instanceId: instance.id,
            machineType: instance.machineType?.split('/').pop(),
            cpuPlatform: instance.cpuPlatform,
          });
        }
      }
    }

    return instanceArray;
  }
}
