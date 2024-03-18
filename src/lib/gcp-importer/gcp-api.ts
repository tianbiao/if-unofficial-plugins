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
    console.log(`getMetricsTimeseries params: ${params}`);
    console.log(`getMetricsTimeseries metricType: ${metricType}`);

    const monitorClient = new MetricServiceClient();
    const projectId = 'tw-dso-dev-a856';

    const request = {
      name: monitorClient.projectPath(projectId),
      filter: `metric.type="compute.googleapis.com/${metricType}"`,
      interval: {
        startTime: {
          // Limit results to the last 20 minutes
          seconds: Date.now() / 1000 - 60 * 20,
        },
        endTime: {
          seconds: Date.now() / 1000,
        },
      },
    };
    const [timeSeries] = await monitorClient.listTimeSeries(request);

    console.log('Found data points for the following instances:');
    timeSeries.forEach(data => {
      console.log(data);
      if (data && data.points) {
        data.points.forEach(point => {
          console.log(
            `data.points: ${JSON.stringify(point.interval)} , ${JSON.stringify(
              point.value
            )}`
          );
        });
      }
    });
    return [];
  }
}
