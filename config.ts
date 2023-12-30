import * as ec2 from 'aws-cdk-lib/aws-ec2'

export interface Config {
    vpcId: string
    InstanceType: ec2.InstanceType
}

export const devConfig: Config = {
    vpcId: 'bbbbbbbbbb',
    InstanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO)
}

export const prodConfig: Config = {
    vpcId: 'bbbbbbbbbb',
    InstanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.SMALL)
}
