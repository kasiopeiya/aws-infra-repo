import { Tracer, captureLambdaHandler } from '@aws-lambda-powertools/tracer'
import middy from '@middy/core'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

interface DynamoDBStreamEvent {
  eventID: string
  eventName: string
  eventVersion: string
  eventSource: string
  awsRegion: string
  dynamodb: {
    ApproximateCreationDateTime: number
    Keys: {
      SK: { S: string }
      PK: { S: string }
    }
    NewImage: Record<
      string,
      {
        N?: string
        S?: string
      }
    > // 可変数のkeyを持つオブジェクト
    SequenceNumber: string
    SizeBytes: number
    StreamViewType: string
  }
  eventSourceARN: string
}

interface EventProps {
  Records: DynamoDBStreamEvent[]
}

const client = new DynamoDBClient({})
const tracer = new Tracer({ serviceName: 'DynamoDBStreamConsumer' })

/**
 * ハンドラー関数
 * @param event
 */
const lambdaHandler = (event: unknown): void => {
  tracer.captureAWSv3Client(client)
  console.log(`Lambda Start: batch size ${(event as EventProps).Records.length}`)

  for (const record of (event as EventProps).Records) {
    console.log(record.dynamodb.NewImage)
  }

  console.log('Lambda Finish')
}

export const handler = middy(lambdaHandler).use(captureLambdaHandler(tracer))
