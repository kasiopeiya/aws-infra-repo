import { Stack, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'

export class BaseStack extends Stack {
  public readonly instanceRole: iam.IRole

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    /*
    * IAM
    -------------------------------------------------------------------------- */
    // IAM User ECS
    new iam.User(this, 'IAMUserECS', {
      userName: 'ecs-user',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonECS_FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryFullAccess')
      ]
    })

    // IAM Role
    this.instanceRole = new iam.Role(this, 'instanceIamRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      roleName: 'InstanceBasicRole',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess')
      ]
    })
  }
}
