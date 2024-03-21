# GCP-importer

> [!NOTE] > `GCP Importer` is an unofficial, not part of the IF standard library. This means the IF core team are not closely monitoring these plugins to keep them up to date. You should do your own research before implementing them!

The GCP importer plugin allows you to provide some basic details about an Azure virtual machine and automatically populate your `manifest` with usage metrics that can then be passed along a plugin pipeline to calculate energy and carbon impacts.

## Prerequisites

### 1. Create a Google Compute Engine VM instance
Create a GCP project and follow the guide of creating a compute engine vm instance https://cloud.google.com/compute/docs/instances/create-start-instance#console

### 2. Create a service account to access Google Compute Engine instance metadata and Google Monitoring metrics
Create a service account and grant some roles for the service account to access GCP resources when running if manifest file.

[crate service account](https://cloud.google.com/iam/docs/service-accounts-create)

### 3. Provide IAM access
Follow this [guide](https://cloud.google.com/iam/docs/manage-access-service-accounts) to grant below roles to the service account
```text
Compute Viewer
Monitoring Viewer
```

Create a service account key and download the json file to your local laptop.

### 4. Add credentials to `.env`

Create a `.env` file in the IF project root directory. This is where you can store your Azure authentication details. Your `.env` file should look as follows:

```txt
GOOGLE_APPLICATION_CREDENTIALS: <Path to your service account key>
```

## Node config
- `gcp-project-id`: Your gcp project id

## Inputs

All that remains is to provide the details about your virtual machine in the `inputs` field in your `manifest`.
These are the required fields:

- `timestamp`: An ISO8601 timestamp indicating the start time for your observation period. We work out your `timespan` by adding `duration` to this initial start time.
- `duration`: Number of seconds your observation period should last. We add this number of seconds to `timestamp` to work out when your observation period should stop.

These are all provided as `inputs`. You also need to instantiate an `gcp-importer` plugin to handle the GCP-specific `input` data. Here's what a complete `manifest` could look like:

```yaml
name: gcp-demo
description: example manifest invoking GCP importer plugin
initialize:
  plugins:
    gcp-importer:
      method: GcpImporter
      path: '@grnsft/if-unofficial-plugins'
  outputs:
    - yaml
tree:
  children:
    child:
      pipeline:
        - gcp-importer
      config:
        gcp-importer:
          gcp-project-id: 'carbon-hack-2024'
      inputs:
        - timestamp: '2024-03-21T01:48:39.691Z'
          duration: 120
```

This will grab GCP metrics for `carbon-hack-2024` for 120 seconds period

## Outputs

The GCP importer plugin will enrich your `manifest` with the following data:

- `cloud/vendor`: the cloud vendor, hardcoded to 'gcp'
- `cloud/instance-type`: the instance type of vm instance e.g. e2-small
- `cloud/cpu-platform`: the cpu platform of vm instance
- `cloud/instance-name`: the name of vm instance
- `cloud/instance-id`: the id of vm instance
- `cloud/zone`: the zone of vm instance
- `cpu/utilization`: percentage CPU utilization
- `memory/total/GB`: Memory currently used in the VM. This metric is only available for VMs that belong to the e2 family. Sampled every 60 seconds. After sampling, data is not visible for up to 240 seconds.
- `memory/used/GB`: The total amount of memory in the VM. This metric is only available for VMs that belong to the e2 family. Sampled every 60 seconds. After sampling, data is not visible for up to 240 seconds.
- `memory/utilization`: memory utilized, expressed as a percentage (`memory/used/GB`/`memory/capacity/GB` * 100)

These can be used as inputs in other plugins in the pipeline. Typically, the `instance-type` can be used to obtain `tdp-finder` data that can then, along with `cpu/utilization`, feed a plugin such as `ccf`.

The outputs look as follows:

```yaml
outputs:
  - cloud/vendor: gcp
    cloud/instance-type: e2-small
    cloud/cpu-platform: Intel Broadwell
    cloud/instance-name: carbon-hack-instance-e2-small
    cloud/instance-id: '2210815774305955705'
    cloud/zone: zones/us-central1-a
    cpu/utilization: 0.003803976554200557
    memory/total/GB: 2.0767006720000003
    memory/used/GB: 0.34238464
    memory/utilization: 0.8351304814331952
    timestamp: '2024-03-21T01:50:00.000Z'
    duration: 60
    gcp-project-id: carbon-hack-2024
```

You can run this example `manifest` by saving it as `./examples/manifests/test/gcp-importer.yml` and executing the following command from the project root:

```sh
npm i -g @grnsft/if
npm i -g @grnsft/if-unofficial-plugins
ie --manifest ./examples/manifests/test/gcp-importer.yml --output ./examples/outputs/gcp-importer.yml
```

The results will be saved to a new `yaml` file in `./examples/outputs`.
