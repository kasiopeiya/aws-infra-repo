import axios from 'axios'
import { SignatureV4 } from '@aws-sdk/signature-v4'
import { HttpRequest } from '@aws-sdk/protocol-http'
import { type HttpRequest as HttpRequest_, type AwsCredentialIdentity } from '@smithy/types'
import { Sha256 } from '@aws-crypto/sha256-js'
import { Agent as HttpsAgent } from 'https'
import * as winston from 'winston'

// 実行条件
const executionCount = 1 // リクエスト送信回数
const executionInterval = 5 // 送信インターバル(秒)
const recordNumberPerRequest = 300 // リクエストあたりレコード数
const recordSize = 10 // １レコードのサイズ

// API GW設定
const streamName = 'test-kds-sample-adv-stream'
const url_ = new URL(
  `https://a313aumlu1.execute-api.ap-northeast-1.amazonaws.com/dev/streams/${streamName}/records`
)

// 認証情報: 環境変数にセット済み前提
const accessKey_ = process.env.AWS_ACCESS_KEY
const secretAccessKey_ = process.env.AWS_SECRET_ACCESS_KEY
if (accessKey_ === undefined || secretAccessKey_ === undefined) {
  throw new Error('AccessKey or SecretAccessKey is undefined')
}
const credentials_: AwsCredentialIdentity = {
  accessKeyId: accessKey_,
  secretAccessKey: secretAccessKey_
}

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.cli(),
    winston.format.printf((info) => `[${info.timestamp}]${info.level}${info.message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'kinesisPutRecordSample.log' })
  ]
})

interface KinesisRecordType {
  data: string
  'partition-key': string
}
interface PayloadIF {
  records: KinesisRecordType[]
}

/**
 * テストデータを生成する
 * @param startAt レコードIdの初期値
 * @param numOfData  生成したいレコード数
 * @param idSuffix レコードIdのサフィックス
 * @returns 生成されたレコードリスト
 */
function generateRecords(
  startAt: number = 1,
  numOfData: number = 10,
  idSuffix: number = 1
): KinesisRecordType[] {
  const records: KinesisRecordType[] = []

  const dataTypes = ['free', 'normal', 'premium'] as const
  const dataBody = 'A'.repeat(recordSize)

  for (let i = startAt; i < startAt + numOfData; i++) {
    const id = `id-${i}-${idSuffix}`
    const systemId = 'HogeSystem'
    const timeStamp = Date.now()
    const email = `hoge${i}_${idSuffix}@mail.com`
    const dataType = dataTypes[Math.floor(Math.random() * dataTypes.length)]
    const record: KinesisRecordType = {
      data: `${id},${systemId},${timeStamp},${email},${dataType},${dataBody}`,
      'partition-key': id
    }
    records.push(record)
  }

  return records
}

/**
 * HTTPリクエストを作成する
 * @param payload
 * @returns
 */
function createHTTPRequest(payload: PayloadIF): HttpRequest_ {
  const req = new HttpRequest({
    method: 'PUT',
    path: url_.pathname,
    hostname: url_.hostname,
    headers: {
      'content-type': 'application/json',
      Host: url_.hostname
    },
    body: JSON.stringify(payload)
  })
  return req
}

/**
 * IAM認証のためHTTPリクエストを署名V4で署名する
 * @param req
 * @returns
 */
async function signHttpReqeust(req: HttpRequest_): Promise<HttpRequest_> {
  const signer = new SignatureV4({
    credentials: credentials_,
    region: 'ap-northeast-1',
    service: 'execute-api',
    sha256: Sha256
  })
  return await signer.sign(req)
}

/**
 * API Gatewayに対してリクエスト送信
 * @param httpRequest
 * @param retries
 */
async function sendRequest(httpRequest: HttpRequest_, retries: number = 3): Promise<void> {
  try {
    const response = await axios.request({
      method: httpRequest.method,
      url: url_.toString(),
      headers: httpRequest.headers,
      httpsAgent: new HttpsAgent({
        rejectUnauthorized: true
      }),
      data: httpRequest.body
    })
    logger.info(`status: ${response.status}, data: ${response.data}`)
  } catch (e: any) {
    if (retries > 0) {
      // スロットリングエラーの場合、即時リトライしてもエラーになるので待機
      await wait(1)
      logger.warn(`Request failed. Retrying... (${retries} retries left)`)
      await sendRequest(httpRequest, retries - 1)
    } else {
      logger.error(e)
    }
  }
}

/**
 * 指定した秒数待機する
 * @param ms
 */
async function wait(second: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve()
    }, second * 1000)
  })
}

const main = async (): Promise<void> => {
  for (let i = 1; i <= executionCount; i++) {
    console.log(`${i}/${executionCount}`)

    // 送信データ作成
    const payload1: PayloadIF = { records: generateRecords(1, recordNumberPerRequest, i) }
    const payload2: PayloadIF = {
      records: generateRecords(1 + recordNumberPerRequest, recordNumberPerRequest, i)
    }
    const payload3: PayloadIF = {
      records: generateRecords(
        1 + recordNumberPerRequest + recordNumberPerRequest,
        recordNumberPerRequest,
        i
      )
    }

    // HTTPリクエスト作成
    const request1 = createHTTPRequest(payload1)
    const request2 = createHTTPRequest(payload2)
    const request3 = createHTTPRequest(payload3)

    // リクエスト署名: IAM認証
    const signedRequest1 = await signHttpReqeust(request1)
    const signedRequest2 = await signHttpReqeust(request2)
    const signedRequest3 = await signHttpReqeust(request3)

    // リクエスト送信
    void Promise.all([
      sendRequest(signedRequest1),
      sendRequest(signedRequest2),
      sendRequest(signedRequest3)
    ])

    // 待機
    await new Promise<void>((resolve) => setTimeout(resolve, executionInterval * 1000))
  }
}

void main()
logger.info('hoge')
