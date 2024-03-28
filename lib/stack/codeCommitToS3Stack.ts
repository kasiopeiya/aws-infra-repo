import { Stack, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import * as codecommit from 'aws-cdk-lib/aws-codecommit'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline'
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions'
import { Bucket } from 'aws-cdk-lib/aws-s3'

interface DeployToS3PipelineStackProps extends StackProps {
  codeCommitRepoName: string
  deployS3BucketName: string
  buildCommands: string[]
  artifactName: string
}

/**
 * CodeCommitのソースを編集し,S3にデプロイするパイプライン
 */
export class DeployToS3PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: DeployToS3PipelineStackProps) {
    super(scope, id, props)

    /*
    * デプロイ先S3 Bucket
    -------------------------------------------------------------------------- */
    const deployS3Bucket = Bucket.fromBucketName(this, 'DeployBukcet', props.deployS3BucketName)

    /*
    * CodeCommit
    -------------------------------------------------------------------------- */
    const repo = codecommit.Repository.fromRepositoryName(
      this,
      'CodeCommitRepo',
      props.codeCommitRepoName
    )

    /*
    * CodeBuild
    -------------------------------------------------------------------------- */
    const project = new codebuild.PipelineProject(this, 'BuildProject', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: props.buildCommands
          }
        },
        artifacts: {
          files: [props.artifactName]
        }
      })
    })
    const sourceOutput = new codepipeline.Artifact()
    const buildOutput = new codepipeline.Artifact()
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      branch: 'main',
      repository: repo,
      output: sourceOutput
    })
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project,
      input: sourceOutput,
      outputs: [buildOutput]
    })
    const deployAction = new codepipeline_actions.S3DeployAction({
      actionName: 'S3Deploy',
      input: buildOutput,
      bucket: deployS3Bucket,
      objectKey: 'dataStreamingGuide.zip',
      extract: false
    })

    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction]
        },
        {
          stageName: 'Build',
          actions: [buildAction]
        },
        {
          stageName: 'S3Deploy',
          actions: [deployAction]
        }
      ]
    })
    deployS3Bucket.grantReadWrite(pipeline.role)
  }
}
