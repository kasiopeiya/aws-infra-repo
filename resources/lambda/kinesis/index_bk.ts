import { Tracer, captureLambdaHandler } from '@aws-lambda-powertools/tracer'
import middy from '@middy/core'
// import { type Handler } from 'aws-cdk-lib/aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BatchGetCommand, BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

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

interface DynamoTableItem {
  userId: string
  email: string
  userType: string
  timeStamp: string
  createdAt?: number
}

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

if (process.env.TABLE_NAME === undefined) {
  throw new Error('Table Name is not defined')
}
const tableName = process.env.TABLE_NAME

const tracer = new Tracer({ serviceName: 'serverlessAirline' })

/**
 * 配列をチャンク分割する
 * @param arrayData
 * @param chunkSize
 * @returns T[][]
 */
function chunks<T>(arrayData: T[], chunkSize: number = 25): T[][] {
  const arrayLength: number = Math.ceil(arrayData.length / chunkSize)
  const mappingFunction = (_: unknown, i: number): T[] => {
    return arrayData.slice(i * chunkSize, i * chunkSize + chunkSize)
  }
  return Array.from({ length: arrayLength }, mappingFunction)
}

/**
 * DynamoDBからバッチで情報を取得する
 * @param keys
 * @returns
 */
async function batchGetItems(
  keys: Array<{
    userId: string
    timeStamp: string
  }>
): Promise<DynamoTableItem[]> {
  const command = new BatchGetCommand({
    RequestItems: {
      [tableName]: {
        Keys: keys
        // ProjectionExpression: 'userId, email, userType'
      }
    }
  })
  const response = await docClient.send(command)
  if (response.Responses === undefined) {
    return []
  } else {
    console.log(response.Responses[tableName])
    return response.Responses[tableName] as DynamoTableItem[]
  }
}

/**
 * ハンドラー関数
 * @param event
 */
const lambdaHandler = async (event: unknown): Promise<void> => {
  tracer.captureAWSv3Client(client)

  console.log('Lambda Start')

  const event_ = event as EventProps
  // const segment = tracer.getSegment()!
  // const subsegment = segment.addNewSubsegment(`## ${process.env._HANDLER}`)
  // tracer.setSegment(subsegment)
  // tracer.annotateColdStart()
  // tracer.addServiceNameAnnotation()

  // Kinesis Recordのデータ部分取り出し
  const incomingData: DynamoTableItem[] = []
  for (const kinesisRecord of event_.Records) {
    const decodedData: string = Buffer.from(kinesisRecord.kinesis.data, 'base64').toString('utf-8')
    const parts = decodedData.split(',')
    incomingData.push({
      userId: parts[0],
      email: parts[1],
      userType: parts[2],
      timeStamp: parts[3]
    })
  }

  // 処理済みアイテム取得
  const batchGetKeys = incomingData.map((data) => {
    return { userId: data.userId, timeStamp: data.timeStamp }
  })
  const completedRecords: DynamoTableItem[] = await batchGetItems(batchGetKeys)
  const userIdTimestamps = completedRecords.map((item: DynamoTableItem): string => {
    return `${item.userId}_${item.timeStamp}`
  })

  // 何らかの処理を行う
  const newItems: DynamoTableItem[] = []
  for (const record of event_.Records) {
    const decodedData: string = Buffer.from(record.kinesis.data, 'base64').toString('utf-8')
    const parts = decodedData.split(',')
    const userId_ = parts[0]
    const email_ = parts[1]
    const userType_ = parts[2]
    const timeStamp_ = parts[3]

    // 処理済み確認
    if (userIdTimestamps.includes(`${userId_}_${timeStamp_}`)) continue

    // 何らかの処理を実装
    console.log(
      `record: userId: ${userId_}, email: ${email_}, userType: ${userType_}, timeStamp: ${timeStamp_}`
    )

    newItems.push({
      userId: userId_,
      email: email_,
      userType: userType_,
      timeStamp: timeStamp_
    })
  }

  // 処理済みデータをDynamoDBバッチ書き込み
  for (const chunk of chunks(newItems, 5)) {
    const putRequests = chunk.map((record) => ({
      PutRequest: {
        Item: {
          userId: record.userId,
          email: record.email,
          userType: record.userType,
          timeStamp: record.timeStamp,
          createdAt: Date.now()
        }
      }
    }))
    const command = new BatchWriteCommand({
      RequestItems: {
        [tableName]: putRequests
      }
    })
    await docClient.send(command)
  }

  console.log('Lambda Finish')

  // subsegment.close()
  // tracer.setSegment(segment)
  tracer.putAnnotation('successfulBooking', true)
}

export const handler = middy(lambdaHandler).use(captureLambdaHandler(tracer))
