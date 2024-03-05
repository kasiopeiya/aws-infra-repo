import { Stack, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import * as kds from 'aws-cdk-lib/aws-kinesis'

import { KdsPublicApiGwProducer } from '../construct/kdsPublicApiGwProducer'
import { KdsLambdaDynamoConsumer } from '../construct/kdsLambdaDynamoConsumer'

interface KdsSampleAdvStackProps extends StackProps {
  prefix: string
  vpcId: string
}

export class KdsSampleAdvStack extends Stack {
  constructor(scope: Construct, id: string, props: KdsSampleAdvStackProps) {
    super(scope, id, props)

    /*
    * Kinesis Data Streams
    -------------------------------------------------------------------------- */
    const stream = new kds.Stream(this, 'KDS', {
      streamMode: kds.StreamMode.PROVISIONED,
      shardCount: 1,
      streamName: `${props.prefix}-stream`
    })

    /*
    * Producer側
    -------------------------------------------------------------------------- */
    // // VPC(既存)
    // const vpc_ = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: props.vpcId })

    // // API Gateway
    // new KdsPrivateApiGwProducer(this, 'KdsPrivateApiGwProducer', {
    //   prefix: props.prefix,
    //   dataStreamName: stream.streamName,
    //   vpc: vpc_ as ec2.Vpc
    // })

    new KdsPublicApiGwProducer(this, 'KdsPublicApiGwProducer', {
      prefix: props.prefix,
      dataStreamName: stream.streamName
    })

    /*
    * Consumer側
    -------------------------------------------------------------------------- */
    new KdsLambdaDynamoConsumer(this, 'kdsLambdaDynamoConsumer', {
      prefix: props.prefix,
      dataStream: stream,
      lambdaEntry: './resources/lambda/kinesis/index.ts'
    })

    // new KdsLambdaDynamoStreamConsumer(this, 'KdsLambdaDynamoStreamConsumer', {
    //   prefix: props.prefix,
    //   dataStream: stream,
    //   kdsLambdaEntry: './resources/lambda/kinesis/index.ts',
    //   dynamoLambdaEntry: './resources/lambda/dynamodbStream/index.ts',
    //   billing: dynamodb.Billing.onDemand()
    // })
  }
}
