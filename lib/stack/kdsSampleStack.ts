import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import * as kds from 'aws-cdk-lib/aws-kinesis'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs'
import * as lambda_ from 'aws-cdk-lib/aws-lambda'
import { SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as apigw from 'aws-cdk-lib/aws-apigateway'

interface KdsSampleStackProps extends StackProps {
  prefix: string
}

export class KdsSampleStack extends Stack {
  constructor(scope: Construct, id: string, props: KdsSampleStackProps) {
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
    // IAM Role
    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonAPIGatewayPushToCloudWatchLogs'
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonKinesisFullAccess')
      ]
    })

    // API Gateway
    const restApi = new apigw.RestApi(this, 'RestApi', {
      restApiName: `${props.prefix}-rest-api`,
      deployOptions: {
        stageName: 'dev'
      },
      endpointConfiguration: {
        types: [apigw.EndpointType.REGIONAL]
      }
    })

    // エンドポイントの追加
    const streamsResource = restApi.root.addResource('streams')
    const streamNameResource = streamsResource.addResource('{stream-name}')
    const recordsResource = streamNameResource.addResource('records')

    // AWS統合設定
    const awsIntegration = new apigw.AwsIntegration({
      service: 'kinesis',
      action: 'PutRecords',
      options: {
        requestParameters: {
          'integration.request.header.Content-Type': "'x-amz-json-1.1'"
        },
        credentialsRole: role,
        passthroughBehavior: apigw.PassthroughBehavior.WHEN_NO_TEMPLATES,
        requestTemplates: {
          'application/json': `{
"StreamName": "${stream.streamName}",
"Records": [
  #foreach($elem in $input.path('$.records'))
    {
      "Data": "$util.base64Encode($elem.data)",
      "PartitionKey": "$elem.partition-key"
    }#if($foreach.hasNext),#end
    #end
]
}`
        },
        // 統合レスポンスの設定
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': '{"result":"ok"}'
            }
          },
          {
            statusCode: '400',
            selectionPattern: 'Malformed.*',
            responseTemplates: {
              'application/json': '{"result":"Kinesis Error"}'
            }
          }
        ]
      }
    })

    // メソッドリクエスト, レスポンス
    const methodOptions: apigw.MethodOptions = {
      methodResponses: [
        {
          statusCode: '200'
        },
        {
          statusCode: '400'
        }
      ]
    }
    // メソッド追加
    recordsResource.addMethod('PUT', awsIntegration, methodOptions)

    /*
    * Consumer側
    -------------------------------------------------------------------------- */
    // SQS
    const deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue')

    // Lambda Function
    const func = new nodejsLambda.NodejsFunction(this, 'LambdaFunc', {
      entry: './resources/lambda/kinesis/index.ts',
      runtime: lambda_.Runtime.NODEJS_18_X,
      handler: 'handler',
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
      bisectBatchOnError: true, // 処理エラー時にバッチを２分割
      batchSize: 8, // 関数あたりの処理レコード数
      maxBatchingWindow: Duration.seconds(10), // バッファリングインターバル
      maxRecordAge: Duration.seconds(60), // レコード期限切れまでの時間
      parallelizationFactor: 1, // シャードあたり起動させる関数の数
      reportBatchItemFailures: false, // エラー処理のレポート
      retryAttempts: 4, // リトライ回数
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
