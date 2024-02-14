import { Stack, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as apigw from 'aws-cdk-lib/aws-apigateway'

interface PrivateAPIGWStackProps extends StackProps {
  prefix: string
  streamName: string
  vpcId: string
}

export class PrivateAPIGWStack extends Stack {
  constructor(scope: Construct, id: string, props: PrivateAPIGWStackProps) {
    super(scope, id, props)

    /*
    * VPC
    -------------------------------------------------------------------------- */
    // VPC(既存)
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: props.vpcId })
    // VPCエンドポイント用SG
    const vpcEndpointSecurityGroup = new ec2.SecurityGroup(this, 'vpcEndpointSecurityGroup', {
      vpc
    })
    vpcEndpointSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.allTcp())
    // VPC エンドポイント
    const privateApiVpcEndpoint = new ec2.InterfaceVpcEndpoint(this, 'privateApiVpcEndpoint', {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
      subnets: { subnets: vpc.publicSubnets },
      securityGroups: [vpcEndpointSecurityGroup],
      open: false
    })

    /*
    * IAM
    -------------------------------------------------------------------------- */
    // IAM Role
    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      roleName: `${props.prefix}-role`,
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
    const restApi = new apigw.RestApi(this, 'RestApi', {
      restApiName: `${props.prefix}-rest-api`,
      deployOptions: {
        stageName: 'dev'
      },
      endpointConfiguration: {
        types: [apigw.EndpointType.PRIVATE],
        vpcEndpoints: [privateApiVpcEndpoint]
      },
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.DENY,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
            conditions: {
              StringNotEquals: { 'aws:sourceVpce': privateApiVpcEndpoint.vpcEndpointId }
            }
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*']
          })
        ]
      })
    })

    // エンドポイントの追加
    const streamsResource = restApi.root.addResource('streams')
    const streamNameResource = streamsResource.addResource('{stream-name}')
    const recordsResource = streamNameResource.addResource('records')

    // API GatewayからKinesis Data Streamsに流す設定を作成
    recordsResource.addMethod(
      'PUT',
      new apigw.AwsIntegration({
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
  "StreamName": "${props.streamName}",
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
              statusCode: '400'
            }
          ]
        }
      }),
      // メソッドレスポンスの設定
      {
        methodResponses: [
          {
            statusCode: '200'
          },
          {
            statusCode: '400'
          }
        ]
      }
    )
  }
}
