import { Stack, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import * as kds from 'aws-cdk-lib/aws-kinesis'
// import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { type Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda'
import { type RestApi } from 'aws-cdk-lib/aws-apigateway'

import { KdsPublicApiGwProducer } from '../construct/kdsPublicApiGwProducer'
// import { KdsPrivateApiGwProducer } from '../construct/kdsPrivateApiGwProducer'
import { KdsLambdaDynamoConsumer } from '../construct/kdsLambdaDynamoConsumer'

interface KdsSampleAdvStackProps extends StackProps {
  prefix: string
  vpcId: string
}

export class KdsSampleAdvStack extends Stack {
  public readonly restApi: RestApi
  public readonly dataStream: kds.Stream
  public readonly kdsConsumerFunc: LambdaFunction

  constructor(scope: Construct, id: string, props: KdsSampleAdvStackProps) {
    super(scope, id, props)

    /*
    * Kinesis Data Streams
    -------------------------------------------------------------------------- */
    this.dataStream = new kds.Stream(this, 'KDS', {
      streamMode: kds.StreamMode.PROVISIONED,
      shardCount: 1,
      streamName: `${props.prefix}-stream`
    })

    /*
    * Producer側
    -------------------------------------------------------------------------- */
    // VPC(既存)
    // const vpc_ = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: props.vpcId })

    // // API Gateway
    // new KdsPrivateApiGwProducer(this, 'KdsPrivateApiGwProducer', {
    //   prefix: props.prefix,
    //   dataStreamName: this.dataStream.streamName,
    //   vpc: vpc_ as ec2.Vpc
    // })

    const producer = new KdsPublicApiGwProducer(this, 'KdsPublicApiGwProducer', {
      prefix: props.prefix,
      dataStreamName: this.dataStream.streamName
    })
    this.restApi = producer.restApi

    /*
    * Consumer側
    -------------------------------------------------------------------------- */
    const consumer = new KdsLambdaDynamoConsumer(this, 'kdsLambdaDynamoConsumer', {
      prefix: props.prefix,
      dataStream: this.dataStream,
      lambdaEntry: './resources/lambda/kinesis/index.ts',
      billing: dynamodb.Billing.onDemand()
    })
    this.kdsConsumerFunc = consumer.kdsConsumerFunction

    // new KdsLambdaDynamoStreamConsumer(this, 'KdsLambdaDynamoStreamConsumer', {
    //   prefix: props.prefix,
    //   dataStream: stream,
    //   kdsLambdaEntry: './resources/lambda/kinesis/index.ts',
    //   dynamoLambdaEntry: './resources/lambda/dynamodbStream/index.ts',
    //   billing: dynamodb.Billing.onDemand()
    // })
  }
}
