import { Stack, type StackProps } from 'aws-cdk-lib'
import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import type * as iam from 'aws-cdk-lib/aws-iam'

import { type Construct } from 'constructs'

interface UbuntuStackProps extends StackProps {
  role: iam.IRole
}

export class UbuntuStack extends Stack {
  constructor(scope: Construct, id: string, props: UbuntuStackProps) {
    super(scope, id, props)

    const defaultVpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true })

    const instance = new ec2.Instance(this, 'Instance', {
      vpc: defaultVpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.genericLinux({
        'ap-northeast-1': 'ami-0d52744d6551d851e'
      }),
      role: props.role,
      keyName: 'ssh-key'
    })

    new cdk.CfnOutput(this, 'SSMCommand', {
      value: `aws ssm start-session --target ${instance.instanceId}`,
      exportName: 'sessionManagerCommand'
    })
  }
}
