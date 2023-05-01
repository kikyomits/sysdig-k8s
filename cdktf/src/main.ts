import { PROJECT_NAME, SysdigInfra } from './stacks/infra'
import { App } from 'cdktf'
import { ApplicationStack } from './stacks/app'

const app = new App()
new SysdigInfra(app, `${PROJECT_NAME}-infra`)
new ApplicationStack(app, `${PROJECT_NAME}-app`)
app.synth()
