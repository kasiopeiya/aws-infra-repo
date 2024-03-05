import { Construct } from 'constructs'
import { Duration, RemovalPolicy } from 'aws-cdk-lib'
import { LambdaPowertoolsLayer } from 'cdk-aws-lambda-powertools-layer'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs'
import * as lambda_ from 'aws-cdk-lib/aws-lambda'
import { SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { type Stream } from 'aws-cdk-lib/aws-kinesis'

interface kdsLambdaDynamoConsumerProps {
  prefix: string
  dataStream: Stream
  lambdaEntry: string
  billing?: dynamodb.Billing
}

/**
 * Kinesis Lambda Consumer with DynamoDB
 */
export class KdsLambdaDynamoConsumer extends Construct {
  constructor(scope: Construct, id: string, props: kdsLambdaDynamoConsumerProps) {
    super(scope, id)

    props.billing ??= dynamodb.Billing.provisioned({
      readCapacity: dynamodb.Capacity.fixed(3),
      writeCapacity: dynamodb.Capacity.autoscaled({ maxCapacity: 5 })
    })
    /*
    * DynamoDB
    -------------------------------------------------------------------------- */
    const table = new dynamodb.TableV2(this, 'Table', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billing: props.billing,
      tableClass: dynamodb.TableClass.STANDARD,
      encryption: dynamodb.TableEncryptionV2.dynamoOwnedKey(),
      pointInTimeRecovery: false,
      removalPolicy: RemovalPolicy.DESTROY,
      contributorInsights: true,
      timeToLiveAttribute: 'expired',
      dynamoStream: dynamodb.StreamViewType.NEW_IMAGE,
      tags: [{ key: 'Name', value: `${props.prefix}-duplication-mng-table` }]
    })

    /*
    * Lambda
    -------------------------------------------------------------------------- */
    // DLQ
    const kdsDlq = new sqs.Queue(this, 'KinesisDeadLetterQueue')

    // Lambda Layer
    const powertoolsLayer = new LambdaPowertoolsLayer(this, 'Layer', {
      runtimeFamily: lambda_.RuntimeFamily.NODEJS
    })

    // Lambda Function
    const func = new nodejsLambda.NodejsFunction(this, 'LambdaFunc', {
      functionName: `${props.prefix}-kds-consumer-func`,
      entry: props.lambdaEntry,
      handler: 'handler',
      runtime: lambda_.Runtime.NODEJS_18_X,
      architecture: lambda_.Architecture.ARM_64,
      memorySize: 1024,
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ['xray:*'],
          resources: ['*']
        })
      ],
      environment: {
        TABLE_NAME: table.tableName
      },
      layers: [powertoolsLayer],
      tracing: lambda_.Tracing.ACTIVE,
      insightsVersion: lambda_.LambdaInsightsVersion.VERSION_1_0_229_0
    })

    // Lambda Event Source Mapping
    func.addEventSourceMapping('EventSourceMapping', {
      enabled: true,
      eventSourceArn: props.dataStream.streamArn,
      bisectBatchOnError: true, // 処理エラー時にバッチを２分割
      batchSize: 50, // 関数あたりの処理レコード数
      maxBatchingWindow: Duration.seconds(3), // バッファリングインターバル
      maxRecordAge: Duration.seconds(500), // レコード期限切れまでの時間
      parallelizationFactor: 1, // シャードあたり起動させる関数の数
      reportBatchItemFailures: true, // エラー処理のレポート
      retryAttempts: 5, // リトライ回数
      startingPosition: lambda_.StartingPosition.TRIM_HORIZON,
      onFailure: new SqsDlq(kdsDlq)
    })

    // CloudWatch Logs: LogGroup
    new logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/${func.functionName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_DAY
    })

    // 関数からDynamoDBヘのアクセス許可
    table.grantReadWriteData(func)
    props.dataStream.grantRead(func)
  }
}
