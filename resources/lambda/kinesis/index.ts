import { Tracer, captureLambdaHandler } from '@aws-lambda-powertools/tracer'
import middy from '@middy/core'
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommand, PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { KinesisClient } from '@aws-sdk/client-kinesis'
import * as winston from 'winston'

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

const kinesisClient = new KinesisClient({})
const dynamoClient = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(dynamoClient)

if (process.env.TABLE_NAME === undefined) {
  throw new Error('Table Name is not defined')
}
const tableName = process.env.TABLE_NAME

const tracer = new Tracer({ serviceName: 'KinesisConsumerLambda' })

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.cli(),
    winston.format.printf((info) => `[${info.timestamp}] ${info.level} ${info.message}`)
  ),
  transports: [new winston.transports.Console()]
})

/**
 * ハンドラー関数
 * @param event
 */
const lambdaHandler = async (event: unknown): Promise<any> => {
  // X-Rayトレース
  tracer.captureAWSv3Client(kinesisClient)
  tracer.captureAWSv3Client(dynamoClient)

  console.log(`Lambda Start: batch size ${(event as EventProps).Records.length}`)

  for (const record of (event as EventProps).Records) {
    const decodedData: string = Buffer.from(record.kinesis.data, 'base64').toString('utf-8')
    const parts = decodedData.split(',')
    const id_ = parts[0]
    const currentDate = new Date()

    // 重複管理用DynamoDBテーブルにデータを保存
    const command = new PutCommand({
      TableName: tableName,
      Item: {
        id: id_,
        eventId: record.eventID, // shardId:sequenceNumber
        data: decodedData,
        createdAt: currentDate.getTime(),
        expired: currentDate.setDate(currentDate.getDate() + 1) // TTL, 1日後に削除
      },
      ConditionExpression: 'attribute_not_exists(id)' // 条件付き書き込み
    })
    try {
      // アイテムの登録
      const response = await docClient.send(command)
      logger.info(`SUCCESS: id=${id_}, statusCode=${response.$metadata.httpStatusCode}`)
    } catch (e: any) {
      if (e instanceof ConditionalCheckFailedException) {
        // 条件付き書き込みエラー, アイテムがテーブルにすでにあった場合
        logger.warn(`RETRY: id=${id_} 登録済みのため処理をスキップします`)
        continue
      } else {
        // それ以外のエラーの場合, DynamoDBのスロットリングなど
        logger.error(`FAILED: id=${id_} エラーのため処理を中断します`)
        // エラー処理のレポート, エラーになったところから処理を再開させるためsequenceNumberを返す
        return {
          batchItemFailures: [{ itemIdentifier: record.kinesis.sequenceNumber }]
        }
      }
    }

    // やりたい処理を記載
    try {
      console.log('処理実行しました')
    } catch (e: any) {
      // DynamoDBからレコード削除
      const command = new DeleteCommand({
        TableName: tableName,
        Key: { id: id_ }
      })
      await docClient.send(command)
      return {
        batchItemFailures: [{ itemIdentifier: record.kinesis.sequenceNumber }]
      }
    }
  }

  console.log('Lambda Finish')
}

export const handler = middy(lambdaHandler).use(captureLambdaHandler(tracer))
