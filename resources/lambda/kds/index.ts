import { type Handler } from 'aws-cdk-lib/aws-lambda'

interface KinesisRecord {
  kinesis: {
    kinesisSchemaVersion: string
    partitionKey: string
    sequenceNumber: string
    data: string
    approximateArrivalTimestamp: number
  }
  eventSource: string
  eventVersion: string
  eventID: string
  eventName: string
  invokeIdentityArn: string
  awsRegion: string
  eventSourceARN: string
}

interface EventProps {
  Records: KinesisRecord[]
}

// Lambda エントリーポイント
export const handler: Handler = async (event: EventProps) => {
  console.log('Lambda Start')

  for (const record of event.Records) {
    const decodedData: string = atob(record.kinesis.data)
    console.log(decodedData)
    if (decodedData === 'blob2') {
      throw new Error('Lambda Error!!!')
    }
  }

  console.log('Lambda Finish')
}
