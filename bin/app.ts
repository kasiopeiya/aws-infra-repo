#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'

import { LinuxStack } from '../lib/linuxStack'
import { UbuntuStack } from '../lib/ubuntuStack'
import { BaseStack } from '../lib/baseStack'
// import { devConfig, prodConfig } from '../config'

const app = new cdk.App()

const envKey: string = app.node.tryGetContext('env')
if (envKey === undefined) {
    throw new Error('Please specify environment with context option. ex) cdk deploy -c env=dev')
}
const envValues = app.node.tryGetContext(envKey)
if (envValues === undefined) throw new Error('Invalid Environment')
const env = { account: envValues.env.account, region: envValues.env.region }
// const config = getConfig(envKey)

const baseStack = new BaseStack(app, 'BaseStack', { env })

/*
/
----------------------------------------------------------------------------- */
new LinuxStack(app, 'LinuxStack', {
    env,
    role: baseStack.instanceRole
})
new UbuntuStack(app, 'UbuntuStack', {
    env,
    role: baseStack.instanceRole
})

// function getConfig (envKey: string) {
//   if (envKey === 'dev') { return devConfig } else if (envKey === 'prod') { return prodConfig } else { throw new Error('No Support environment') }
// }
