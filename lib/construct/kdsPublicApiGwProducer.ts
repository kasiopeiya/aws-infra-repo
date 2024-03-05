import { RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import * as logs from 'aws-cdk-lib/aws-logs'

interface KdsPublicApiGwProducerProps {
  prefix: string
  dataStreamName: string
  monitoring?: boolean
}

/**
 * API Gateway: Private REST API for Kineis Data Streams
 */
export class KdsPublicApiGwProducer extends Construct {
  constructor(scope: Construct, id: string, props: KdsPublicApiGwProducerProps) {
    super(scope, id)

    props.monitoring ??= true

    /*
    * IAM
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

    /*
    * API Gateway
    -------------------------------------------------------------------------- */
    // CloudWatch Logs
    const accessLogGroup = new logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/apigw/accesslog/${props.prefix}-rest-api`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_DAY
    })

    // REST API DeployOptions
    let deployOption: apigw.StageOptions = { stageName: 'dev' }
    if (props.monitoring) {
      deployOption = {
        stageName: 'dev',
        tracingEnabled: true, // X-Ray
        dataTraceEnabled: true, // 実行ログ
        loggingLevel: apigw.MethodLoggingLevel.INFO, // 実行ログ出力レベル
        accessLogDestination: new apigw.LogGroupLogDestination(accessLogGroup), // アクセスログ出力先
        accessLogFormat: apigw.AccessLogFormat.clf(), // アクセスログフォーマット
        metricsEnabled: true // 詳細メトリクス
      }
    }

    // REST API
    const restApi = new apigw.RestApi(this, 'RestApi', {
      restApiName: `${props.prefix}-rest-api`,
      deployOptions: deployOption,
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
"StreamName": "${props.dataStreamName}",
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
  }
}
