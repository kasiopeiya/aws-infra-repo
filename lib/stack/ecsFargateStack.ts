import { Stack, RemovalPolicy, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'

import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'

// interface EcsFargateStackProps extends StackProps {
// }

export class EcsFargateStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    /*
    * ECR
    -------------------------------------------------------------------------- */
    new ecr.Repository(this, 'WebRepository', {
      repositoryName: 'simple-cicd-web',
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteImages: true
    })

    new ecr.Repository(this, 'APIRepository', {
      repositoryName: 'simple-cicd-api',
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteImages: true
    })

    /*
    * VPC
    -------------------------------------------------------------------------- */
    const defaultVpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true })

    /*
    * ECS
    -------------------------------------------------------------------------- */
    const cluster_ = new ecs.Cluster(this, 'Cluster', {
      vpc: defaultVpc,
      clusterName: 'simple-cicd-cluster',
      containerInsights: true
    })
    const taskExecutionRole = iam.Role.fromRoleName(
      this,
      'TaskExecutionRole',
      'ecsTaskExecutionRole'
    )
    const taskdef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: 256,
      memoryLimitMiB: 512,
      family: 'simple-cicd-def',
      executionRole: taskExecutionRole
    })
    taskdef.addContainer('web', {
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/nginx/nginx:perl'),
      containerName: 'dummy',
      portMappings: [
        {
          protocol: ecs.Protocol.TCP,
          containerPort: 80,
          hostPort: 80
        }
      ],
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'simple-cicd-web',
        logGroup: new logs.LogGroup(this, 'LogGroupWeb', {
          removalPolicy: RemovalPolicy.DESTROY,
          retention: logs.RetentionDays.ONE_DAY
        })
      })
    })

    const sg = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: defaultVpc,
      allowAllOutbound: true,
      securityGroupName: 'simple-cicd-sg'
    })
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80))

    new ecs.FargateService(this, 'Service', {
      cluster: cluster_,
      serviceName: 'simple-cicd-service',
      taskDefinition: taskdef,
      assignPublicIp: true,
      enableExecuteCommand: true,
      desiredCount: 1,
      securityGroups: [sg]
    })
  }
}
