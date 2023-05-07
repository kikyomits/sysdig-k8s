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
import { ServiceAccount } from '@cdktf/provider-kubernetes/lib/service-account'
import { ClusterRole } from '@cdktf/provider-kubernetes/lib/cluster-role'
import { ClusterRoleBinding } from '@cdktf/provider-kubernetes/lib/cluster-role-binding'

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
                name: 'sysdig-agent',
                labels: {
                    'pod-security.kubernetes.io/enforce': 'privileged',
                    'pod-security.kubernetes.io/enforce-version': 'latest',
                    'pod-security.kubernetes.io/audit': 'privileged',
                    'pod-security.kubernetes.io/audit-version': 'latest',
                    'pod-security.kubernetes.io/warn': 'privileged',
                    'pod-security.kubernetes.io/warn-version': 'latest'
                }
            }
        })

        const nsVote = new Namespace(this, 'vote_namespace', {
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
                    name: 'global.kspm.deploy',
                    value: 'true'
                },
                {
                    name: 'agent.auditLog.enabled',
                    value: 'true'
                },
                {
                    name: 'nodeAnalyzer.secure.vulnerabilityManagement.newEngineOnly',
                    value: 'true'
                },
                {
                    name: 'nodeAnalyzer.nodeAnalyzer.benchmarkRunner.deploy',
                    value: 'false'
                },

                {
                    name: 'kspmCollector.namespaces.excluded',
                    value: 'kube-system'
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

        const clusterRole = new ClusterRole(this, 'too_strong_role', {
            metadata: {
                name: 'too-strong-role'
            },
            rule: [
                {
                    apiGroups: ['*'],
                    resources: ['*'],
                    verbs: ['*']
                }
            ]
        })

        const sa = new ServiceAccount(this, 'too_strong_sa', {
            metadata: {
                name: 'too-strong-sa',
                namespace: nsVote.metadata.name
            }
        })

        new ClusterRoleBinding(this, 'too_strong_role_to_too_strong_sa', {
            metadata: {
                name: 'too-strong-role-to-too-strong-sa'
            },
            roleRef: {
                kind: 'ClusterRole',
                apiGroup: 'rbac.authorization.k8s.io',
                name: clusterRole.metadata.name
            },
            subject: [{
                kind: 'ServiceAccount',
                name: sa.metadata.name
            }]
        })
    }
}
