import { Construct } from 'constructs'
import { ContainerCluster } from '@cdktf/provider-google/lib/container-cluster'
import { ServiceAccount } from '@cdktf/provider-google/lib/service-account'
import { ContainerNodePool } from '@cdktf/provider-google/lib/container-node-pool'
import { ComputeFirewall } from '@cdktf/provider-google/lib/compute-firewall'

export interface GkeConfig {
    vpcId: string
    nodeCount: number
    name: string
    location: string
}

export class Gke extends Construct {
    sa: ServiceAccount
    cluster: ContainerCluster
    nodePool: ContainerNodePool

    constructor (scope: Construct, id: string, props: GkeConfig) {
        super(scope, id)

        this.sa = new ServiceAccount(this, 'sa', {
            accountId: `${props.name}-node-pool`,
            displayName: `${props.name}-node-pool-control-plane`
        })

        this.cluster = new ContainerCluster(this, 'cluster', {
            name: props.name,
            location: props.location,
            removeDefaultNodePool: true,
            initialNodeCount: 1
        })

        this.nodePool = new ContainerNodePool(this, 'node_pool', {
            name: props.name,
            location: props.location,
            cluster: this.cluster.name,
            nodeCount: props.nodeCount,
            nodeLocations: ['australia-southeast1-a'],
            nodeConfig: {
                preemptible: true,
                machineType: 'e2-standard-4',
                serviceAccount: this.sa.email,
                oauthScopes: [
                    'https://www.googleapis.com/auth/cloud-platform'
                ]
            }
        })

        new ComputeFirewall(this, 'sg_node', {
            name: `${props.name}-node-pool`,
            network: props.vpcId,
            allow: [
                {
                    ports: ['6443'],
                    protocol: 'tcp'
                }
            ],
            sourceServiceAccounts: [this.sa.email]
        })
    }
}
