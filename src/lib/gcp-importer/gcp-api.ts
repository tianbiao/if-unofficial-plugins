import {MetricServiceClient} from '@google-cloud/monitoring';
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

      if (data && data.points) {
        data.points.forEach(point => {
          instanceMetricArray.push({
            instanceName,
            metricsType,
            startTime: point.interval?.startTime?.seconds,
            endTime: point.interval?.endTime?.seconds,
            value: point.value?.doubleValue,
          });
        });
      }
    });

    return instanceMetricArray;
  }
}
