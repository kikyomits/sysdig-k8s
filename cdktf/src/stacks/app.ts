import { Fn, GcsBackend, TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import { HelmProvider } from '@cdktf/provider-helm/lib/provider'
import { Release } from '@cdktf/provider-helm/lib/release'
import * as dotenv from 'dotenv'
import { BACKEND_BUCKET, PROJECT_NAME } from './infra'
import { Namespace } from '@cdktf/provider-kubernetes/lib/namespace'
import { KubernetesProvider } from '@cdktf/provider-kubernetes/lib/provider'
import { Manifest } from '@cdktf/provider-kubernetes/lib/manifest'
import * as path from 'path'

dotenv.config()

const FILES = [
    'db-deployment.yaml',
    'db-service.yaml',
    'redis-deployment.yaml',
    'redis-service.yaml',
    'result-deployment.yaml',
    'result-service.yaml',
    'vote-deployment.yaml',
    'vote-service.yaml',
    'worker-deployment.yaml'
]

const K8S_CONTEXT = 'gke_sysdig-assessment_australia-southeast1_main'

export class ApplicationStack extends TerraformStack {
    constructor (scope: Construct, id: string) {
        super(scope, id)

        new GcsBackend(this, {
            bucket: BACKEND_BUCKET,
            prefix: `${PROJECT_NAME}/data`
        })

        new HelmProvider(this, 'helm', {
            kubernetes: {
                configPath: '~/.kube/config',
                configContext: K8S_CONTEXT
            }
        })

        new KubernetesProvider(this, 'k8s', {
            configPath: '~/.kube/config',
            configContext: K8S_CONTEXT
        })

        const nsSysdig = new Namespace(this, 'sysdig_namespace', {
            metadata: {
                name: 'sysdig-agent'
            }
        })

        new Namespace(this, 'vote_namespace', {
            metadata: {
                name: 'vote'
            }
        })

        new Release(this, 'sysdig_agent', {
            name: 'sysdig-agent',
            namespace: nsSysdig.metadata.name,
            repository: 'https://charts.sysdig.com',
            chart: 'sysdig-deploy',
            version: '1.7.6',

            set: [
                {
                    name: 'global.clusterConfig.name',
                    value: PROJECT_NAME
                },
                {
                    name: 'global.sysdig.accessKey',
                    value: process.env.SYSDIG_ACCESS_KEY as string
                },
                {
                    name: 'global.sysdig.region',
                    value: 'au1'
                },
                {
                    name: 'nodeAnalyzer.secure.vulnerabilityManagement.newEngineOnly',
                    value: 'true'
                },
                {
                    name: 'global.kspm.deploy',
                    value: 'true'
                },
                {
                    name: 'nodeAnalyzer.nodeAnalyzer.benchmarkRunner.deploy',
                    value: 'false'
                },
                {
                    name: 'ebpf.enabled',
                    value: 'true'
                }
            ]
        })

        FILES.forEach(filename => {
            new Manifest(this, filename, {
                manifest: Fn.yamldecode(Fn.file(path.resolve(`./k8s/vote/${filename}`)))
            })
        })
    }
}
