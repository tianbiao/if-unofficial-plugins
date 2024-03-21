import {MetricServiceClient} from '@google-cloud/monitoring';
import compute from '@google-cloud/compute';
import {GetMetricsParams} from './types';

export class GcpAPI {
  /**
   * Fetches metrics for a specific virtual machine.
   */
  public async getMetricsTimeseries(
    params: GetMetricsParams,
    metricType: string
  ) {
    console.log(`getMetricsTimeseries metricType: ${metricType}`);

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
      console.log('timeSeries data: ', data);

      const instanceName: any = data.metric?.labels?.instance_name;
      const metricsType: any = data.metric?.type;
      const instanceId: any = data.resource?.labels?.instance_id;
      const zone: any = data.resource?.labels?.zone;

      if (data && data.points) {
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

  public async listAllInstances(projectId: string) {
    const instancesClient = new compute.InstancesClient();

    const aggListRequest = instancesClient.aggregatedListAsync({
      project: projectId,
    });

    const instanceArray: any[] = [];
    for await (const [zone, instancesObject] of aggListRequest) {
      const instances = instancesObject.instances;

      if (instances && instances.length > 0) {
        console.log(` ${zone}`);
        for (const instance of instances) {
          console.log(` - ${instance.id} (${instance.machineType})`);
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
