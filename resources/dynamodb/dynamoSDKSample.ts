import { DynamoDBProvider } from '@aws-lambda-powertools/parameters/dynamodb'
import { DynamoDBClient, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import {
  BatchGetCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  DynamoDBDocumentClient
} from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

// const tableName = 'test-kds-sample-adv-stack-TableCD117FA1-OFHIX013BFTR'
const tableName_ = 'test-dynamo-sample-table'

const userId_ = 'id-1'
const email_ = 'hoge1@mail.com'
const userType_ = 'free'
const timeStamp_ = '1708745832224'

const dynamoDBProvider = new DynamoDBProvider({
  tableName: tableName_,
  keyAttr: 'userId',
  sortAttr: 'timeStamp',
  valueAttr: 'userType'
})

export const put = async (): Promise<any> => {
  const command = new PutCommand({
    TableName: tableName_,
    Item: {
      userId: userId_,
      timeStamp: timeStamp_,
      email: email_,
      userType: userType_,
      hoge: {
        a: '1',
        b: '3'
      },
      fuga: ['hoge', 'fuga', 'bar']
    },
    ConditionExpression: 'attribute_not_exists(userId)'
  })

  try {
    const response = await docClient.send(command)
    console.log(response)
  } catch (e: any) {
    if (e instanceof ConditionalCheckFailedException) {
      console.log('登録済みのため処理をスキップします')
    }
  }
}

export const query = async (): Promise<any> => {
  const command = new QueryCommand({
    TableName: tableName_,
    KeyConditionExpression: 'userId = :userId AND #ts > :_timeStamp',
    ExpressionAttributeValues: {
      ':userId': userId_,
      ':_timeStamp': '1708654140230'
    },
    ExpressionAttributeNames: {
      '#ts': 'timeStamp'
    },
    ProjectionExpression: 'userId, userType',
    ConsistentRead: true
  })

  const response = await docClient.send(command)
  console.log(response)
}

export const get = async (): Promise<any> => {
  const getCommand = new GetCommand({
    TableName: tableName_,
    Key: {
      userId: userId_,
      timeStamp: '1708654140236'
    }
  })
  const getResponse = await docClient.send(getCommand)
  console.log(getResponse)
}

export const batchGet = async (): Promise<any> => {
  const command = new BatchGetCommand({
    // Each key in this object is the name of a table. This example refers
    // to a Books table.
    RequestItems: {
      [tableName_]: {
        Keys: [
          {
            userId: userId_,
            timeStamp: timeStamp_
          }
        ],
        ProjectionExpression: 'userId, email, userType'
      }
    }
  })
  const response = await docClient.send(command)
  if (response.Responses !== undefined) {
    console.log(response.Responses[tableName_])
  }
}

export const getMultiple = async (): Promise<void> => {
  const values = (await dynamoDBProvider.getMultiple('id-1')) ?? {}
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}: ${value}`)
  }
}

// void query()
// void get()
void put()
// void batchGet()
// void getMultiple()
