import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch'
import { KinesisClient, DescribeStreamSummaryCommand } from '@aws-sdk/client-kinesis'

// CloudWatch メトリクス名を指定します
const metricName = 'OpenShardCount'

const region = 'ap-northeast-1'

if (process.env.DATA_STREAM_NAME === undefined) {
  throw new Error('Table Name is not defined')
}

/**
 * ハンドラー関数
 * @param event
 */
export const handler = async (event: unknown): Promise<any> => {
  try {
    // シャード数を取得します
    const shardCount = await getOpenShardCount()

    // CloudWatch にメトリクスを送信します
    await sendMetricToCloudWatch(shardCount)

    console.log('CloudWatchにカスタムメトリクスを送信しました:', shardCount)
  } catch (error) {
    console.error('CloudWatchへのメトリクス送信中にエラーが発生しました:', error)
  }
}

/**
 * データストリームのシャード数を取得する
 * @returns
 */
async function getOpenShardCount(): Promise<number> {
  // Kinesis クライアントを作成します
  const kinesisClient = new KinesisClient({ region })

  // DescribeStreamSummary コマンドを作成して実行します
  const command = new DescribeStreamSummaryCommand({ StreamName: process.env.DATA_STREAM_NAME })
  const response = await kinesisClient.send(command)
  if (response.StreamDescriptionSummary?.OpenShardCount === undefined) {
    throw new Error('failed to DescribeStreamSummaryCommand')
  }

  return response.StreamDescriptionSummary.OpenShardCount
}

/**
 * メトリクスデータを送信する
 * @param metricValue
 */
async function sendMetricToCloudWatch(metricValue: number): Promise<void> {
  const cloudwatchClient = new CloudWatchClient({ region })
  const command = new PutMetricDataCommand({
    Namespace: 'Custom/KinesisMetrics',
    MetricData: [
      {
        MetricName: metricName,
        Value: metricValue,
        Unit: 'Count',
        Dimensions: [{ Name: 'dataStreamName', Value: process.env.DATA_STREAM_NAME }]
      }
    ]
  })
  await cloudwatchClient.send(command)
}
