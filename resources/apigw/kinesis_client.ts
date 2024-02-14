import axios from 'axios'
import { SignatureV4 } from '@aws-sdk/signature-v4'
import { HttpRequest } from '@aws-sdk/protocol-http'
import { Sha256 } from '@aws-crypto/sha256-js'
import { Agent as HttpsAgent } from 'https'

// API GW設定
const url_ = new URL(
  'https://d3xl9ds16f.execute-api.ap-northeast-1.amazonaws.com/dev/streams/ts-kds-sample-stream/records'
)
// const url_ = new URL('https://d3xl9ds16f.execute-api.ap-northeast-1.amazonaws.com/dev/streams')
// const queryString = ''

const main = async (): Promise<void> => {
  // 認証情報
  const accessKey_ = process.env.AWS_ACCESS_KEY
  const secretAccessKey_ = process.env.AWS_SECRET_ACCESS_KEY
  if (accessKey_ === undefined || secretAccessKey_ === undefined) {
    throw new Error('AccessKey or SecretAccessKey is undefined')
  }

  const payload = {
    records: [
      {
        data: 'some data',
        'partition-key': 'some key'
      },
      {
        data: 'some other data',
        'partition-key': 'some key'
      }
    ]
  }

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
  const signer = new SignatureV4({
    credentials: {
      accessKeyId: accessKey_,
      secretAccessKey: secretAccessKey_
    },
    region: 'ap-northeast-1',
    service: 'execute-api',
    sha256: Sha256
    // uriEscapePath: false
  })

  const signedHttpRequest = await signer.sign(req)

  try {
    // const response = await request(url_.toString(), {
    //   headers: signedHttpRequest.headers,
    //   method: 'GET'
    //   // body: payload
    // })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    // const response = await axios.put(url_.toString(), payload, {
    //   headers: signedHttpRequest.headers
    // })
    // const r = await axios.get(url_, signedHttpRequest)
    const response = await axios.request({
      method: signedHttpRequest.method,
      url: url_.toString(),
      headers: signedHttpRequest.headers,
      httpsAgent: new HttpsAgent({
        rejectUnauthorized: true
      }),
      data: signedHttpRequest.body
    })
    console.log(response)
  } catch (e: any) {
    console.log(e)
  }
}

void main()
