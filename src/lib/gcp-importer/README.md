# GCP-importer

> [!NOTE] > `GCP Importer` is an unofficial, not part of the IF standard library. This means the IF core team are not closely monitoring these plugins to keep them up to date. You should do your own research before implementing them!

The GCP importer plugin allows you to provide some basic details about an Azure virtual machine and automatically populate your `manifest` with usage metrics that can then be passed along a plugin pipeline to calculate energy and carbon impacts.

## Prerequisites

### 1. Create a Google Compute Engine VM instance


### 2. Provide an identity to access VM metadata and metrics


### 3. Provide IAM access


### 4. Add credentials to `.env`

Create a `.env` file in the IF project root directory. This is where you can store your Azure authentication details. Your `.env` file should look as follows:

```txt

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
tree:
  children:
    child:
      pipeline:
        - gcp-importer
      config:
        gcp-importer:
          gcp-project-id: my_project_id
      inputs:
        - timestamp: '2024-03-17T10:35:31.820Z'
          duration: 3600
```

This will grab GCP metrics for `my_project_id` for one-hour period beginning at 10:35 UTC on 17th March 2024

## Outputs

The GCP importer plugin will enrich your `manifest` with the following data:

- `duration`: the per-input duration in seconds
- `cpu/utilization`: percentage CPU utilization
- `cloud/instance-type`: VM instance name
- `location`: VM region
- `memory/total/GB`: Memory currently used in the VM. This metric is only available for VMs that belong to the e2 family. Sampled every 60 seconds. After sampling, data is not visible for up to 240 seconds.
- `memory/used/GB`: The total amount of memory in the VM. This metric is only available for VMs that belong to the e2 family. Sampled every 60 seconds. After sampling, data is not visible for up to 240 seconds.
- `memory/utilization`: memory utilized, expressed as a percentage (`memory/used/GB`/`memory/capacity/GB` * 100)

These can be used as inputs in other plugins in the pipeline. Typically, the `instance-type` can be used to obtain `tdp-finder` data that can then, along with `cpu/utilization`, feed a plugin such as `teads-curve`.

The outputs look as follows:

```yaml
outputs:
  - timestamp: '2023-11-02T10:35:00.000Z'
    duration: 300
    cpu/utilization: '0.314'
    memory/available/GB: 0.488636416
    memory/used/GB: 0.5113635839999999
    memory/capacity/GB: '1'
    memory/utilization: 51.13635839999999
    location: uksouth
    cloud/instance-type: Standard_B1s
  - timestamp: '2023-11-02T10:40:00.000Z'
    duration: 300
    cpu/utilization: '0.314'
    memory/available/GB: 0.48978984960000005
    memory/used/GB: 0.5102101504
    memory/capacity/GB: '1'
    memory/utilization: 51.021015039999995
    location: uksouth
    cloud/instance-type: Standard_B1s
```

You can run this example `manifest` by saving it as `./examples/manifests/test/gcp-importer.yml` and executing the following command from the project root:

```sh
npm i -g @grnsft/if
npm i -g @grnsft/if-unofficial-plugins
ie --manifest ./examples/manifests/test/gcp-importer.yml --output ./examples/outputs/gcp-importer.yml
```

The results will be saved to a new `yaml` file in `./examples/outputs`.
