
import { Construct } from 'constructs'
import { GcsBackend, TerraformStack } from 'cdktf'
import { GoogleProvider } from '@cdktf/provider-google/lib/provider'
import { Project } from '@cdktf/provider-google/lib/project'
import { ProjectService } from '@cdktf/provider-google/lib/project-service'
import { StorageBucket } from '@cdktf/provider-google/lib/storage-bucket'
import { DataGoogleBillingAccount } from '@cdktf/provider-google/lib/data-google-billing-account'
import { ComputeNetwork } from '@cdktf/provider-google/lib/compute-network'
import { Gke } from '../constructs/gke'

export const BACKEND_BUCKET = 'mits-terraform-backend-2023'
export const PROJECT_NAME = 'sysdig-assessment'
export const LOCATION = 'australia-southeast1'

const SERVICES = [
    'container.googleapis.com',
    'compute.googleapis.com',
    'containerregistry.googleapis.com'
]

const CLUSTERS = [
    'main'
    // 'control'
]

const NODE_COUNT = 1

export class SysdigInfra extends TerraformStack {
    constructor (scope: Construct, name: string) {
        super(scope, name)

        new GoogleProvider(this, 'gcp', {
            project: PROJECT_NAME
        })

        new GcsBackend(this, {
            bucket: BACKEND_BUCKET,
            prefix: `${PROJECT_NAME}/infra`
        })

        const billing = new DataGoogleBillingAccount(this, 'billing', {
            displayName: 'My Billing Account',
            open: true
        })

        const project = new Project(this, 'sysdig', {
            name: PROJECT_NAME,
            projectId: PROJECT_NAME,
            billingAccount: billing.id
        })
        const vpc = new ComputeNetwork(this, 'vpc', {
            name: 'gke',
            project: project.projectId
        })

        SERVICES.forEach(service => {
            new ProjectService(this, service, {
                project: project.projectId,
                service,
                disableDependentServices: true
            })
        })

        new StorageBucket(this, 'backend_bucket', {
            name: BACKEND_BUCKET,
            project: project.projectId,
            location: LOCATION
        })

        CLUSTERS.forEach(cluster => {
            new Gke(this, cluster, {
                name: cluster,
                location: LOCATION,
                nodeCount: NODE_COUNT,
                vpcId: vpc.id
            })
        })
    }
}
