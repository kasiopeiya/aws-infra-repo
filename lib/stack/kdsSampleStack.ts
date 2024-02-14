import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import * as kds from 'aws-cdk-lib/aws-kinesis'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs'
import * as lambda_ from 'aws-cdk-lib/aws-lambda'
import { SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as iam from 'aws-cdk-lib/aws-iam'

export class KdsSampleStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    /*
    * Producer
    -------------------------------------------------------------------------- */
    // API GW

    /*
    * Kinesis Data Streams
    -------------------------------------------------------------------------- */
    const stream = new kds.Stream(this, 'KDS', {
      streamMode: kds.StreamMode.PROVISIONED,
      shardCount: 1,
      streamName: 'ts-kds-sample-stream'
    })

    /*
    * Consumer
    -------------------------------------------------------------------------- */
    // SQS
    const deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue')

    // Lambda Function
    const func = new nodejsLambda.NodejsFunction(this, 'LambdaFunc', {
      entry: './resources/lambda/kds/index.ts',
      // entry: path.join(__dirname, '../resources/lambda/kds/index.ts'),
      runtime: lambda_.Runtime.NODEJS_18_X,
      handler: 'handler',
      // logRetention: logs.RetentionDays.ONE_DAY,
      initialPolicy: [
        new iam.PolicyStatement({
          actions: [
            'kinesis:GetRecords',
            'kinesis:GetShardIterator',
            'kinesis:DescribeStream',
            'kinesis:DescribeStreamSummary',
            'kinesis:ListShards',
            'kinesis:ListStream'
          ],
          resources: [stream.streamArn]
        })
      ]
    })
    // Lambda Event Source Mapping
    func.addEventSourceMapping('EventSourceMapping', {
      enabled: true,
      eventSourceArn: stream.streamArn,
      // filters: [{
      // 	name: "nakajima"
      // }],
      bisectBatchOnError: true,
      batchSize: 2, // バッファサイズ
      maxBatchingWindow: Duration.seconds(10), // バッファリングインターバル
      maxRecordAge: Duration.seconds(60), // レコード期限切れまでの時間
      parallelizationFactor: 1,
      reportBatchItemFailures: true,
      retryAttempts: 10,
      startingPosition: lambda_.StartingPosition.TRIM_HORIZON,
      onFailure: new SqsDlq(deadLetterQueue)
    })

    // CloudWatch Logs: Log Group
    new logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/${func.functionName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_DAY
    })
  }
}
