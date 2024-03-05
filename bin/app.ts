#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'

import { LinuxStack } from '../lib/stack/linuxStack'
import { UbuntuStack } from '../lib/stack/ubuntuStack'
import { BaseStack } from '../lib/stack/baseStack'
import { EcsFargateStack } from '../lib/stack/ecsFargateStack'
import { KdsSamplePrivateStack } from '../lib/stack/kdsSamplePrivateStack'
import { KdsSampleStack } from '../lib/stack/kdsSampleStack'
import { KdsSampleAdvStack } from '../lib/stack/kdsSampleAdvStack'
import { DynamoDBStack } from '../lib/stack/dynamoDBStack'

const app = new cdk.App()

const envKey: string = app.node.tryGetContext('env')
if (envKey === undefined) {
  throw new Error('Please specify environment with context option. ex) cdk deploy -c env=dev')
}
const envValues = app.node.tryGetContext(envKey)
if (envValues === undefined) throw new Error('Invalid Environment')
const env = { account: envValues.env.account, region: envValues.env.region }
// const config = getConfig(envKey)

/*
* Base
-------------------------------------------------------------------------- */
const baseStack = new BaseStack(app, 'base-stack', { env })

/*
* EC2
-------------------------------------------------------------------------- */
new DynamoDBStack(app, 'test-dynamo-sample-stack', {
  prefix: 'test-dynamo-sample'
})

/*
* EC2
-------------------------------------------------------------------------- */
new LinuxStack(app, 'ec2-linux-stack', {
  env,
  role: baseStack.instanceRole
})
new UbuntuStack(app, 'ec2-ubuntu-stack', {
  env,
  role: baseStack.instanceRole
})

/*
* ECS
-------------------------------------------------------------------------- */
new EcsFargateStack(app, 'ecs-fargate-stack', { env })

// function getConfig (envKey: string) {
//   if (envKey === 'dev') { return devConfig } else if (envKey === 'prod') { return prodConfig } else { throw new Error('No Support environment') }
// }

/*
* KDS
-------------------------------------------------------------------------- */
new KdsSamplePrivateStack(app, 'test-kds-sample-prv-stack', {
  env,
  prefix: 'test-kds-sample-prv',
  vpcId: 'vpc-b19d83d6'
})

new KdsSampleStack(app, 'test-kds-sample-stack', {
  prefix: 'test-kds-sample'
})

new KdsSampleAdvStack(app, 'test-kds-sample-adv-stack', {
  env,
  prefix: 'test-kds-sample-adv',
  vpcId: 'vpc-b19d83d6'
})
