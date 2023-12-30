import { Stack, type StackProps } from 'aws-cdk-lib'
import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import type * as iam from 'aws-cdk-lib/aws-iam'

import { type Construct } from 'constructs'

interface LinuxStackProps extends StackProps {
  role: iam.IRole
}

export class LinuxStack extends Stack {
  constructor(scope: Construct, id: string, props: LinuxStackProps) {
    super(scope, id, props)

    const defaultVpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true })

    const instance = new ec2.Instance(this, 'Instance', {
      vpc: defaultVpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      role: props.role,
      keyName: 'ssh-key'
    })

    // const volume = new ec2.Volume(this, 'Volume', {
    //   availabilityZone: instance.instanceAvailabilityZone,
    //   encrypted: true,
    //   size: cdk.Size.gibibytes(8),
    //   removalPolicy: cdk.RemovalPolicy.DESTROY
    // });

    // new ec2.CfnVolumeAttachment(this, 'CfnVolumeAttachment', {
    //   instanceId: instance.instanceId,
    //   volumeId: volume.volumeId,
    //   device: 'xvdf',
    // });

    new cdk.CfnOutput(this, 'SSMCommand', {
      value: `aws ssm start-session --target ${instance.instanceId}`,
      exportName: 'sessionManagerCommand'
    })
  }
}
