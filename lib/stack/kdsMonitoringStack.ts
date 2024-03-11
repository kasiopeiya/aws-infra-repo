import { Duration, Stack, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import * as cw from 'aws-cdk-lib/aws-cloudwatch'
import { type Stream } from 'aws-cdk-lib/aws-kinesis'
import { type Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda'
import { type RestApi } from 'aws-cdk-lib/aws-apigateway'

interface KdsMonitoringStackProps extends StackProps {
  prefix: string
  restApi: RestApi
  dataStream: Stream
  lambdaFunction: LambdaFunction
}

export class KdsMonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props: KdsMonitoringStackProps) {
    super(scope, id, props)

    /*
    * CloudWatch Dashboard
    -------------------------------------------------------------------------- */
    const defaultHeight = 10
    const defaultWidth = 12

    const dashboard = new cw.Dashboard(this, 'Dashboard', {
      defaultInterval: Duration.hours(1),
      dashboardName: `${props.prefix}-dashboard`
    })

    /*
    * API Gateway
    -------------------------------------------------------------------------- */
    // Title
    const apiGwTitleWid = new cw.TextWidget({
      markdown: '# API Gateway',
      height: 2,
      width: 24
    })

    const CountWid = new cw.GraphWidget({
      title: 'Count',
      left: [props.restApi.metricCount()],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'Sum',
      leftYAxis: { min: 0 }
    })

    const LatencyWid = new cw.GraphWidget({
      title: 'Latency',
      left: [props.restApi.metricLatency()],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'p99',
      leftYAxis: { min: 0 }
    })

    const ErrorCountWid = new cw.GraphWidget({
      title: 'ErrorCount',
      left: [props.restApi.metricClientError()],
      right: [props.restApi.metricServerError()],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'Sum',
      leftYAxis: { min: 0 }
    })

    dashboard.addWidgets(apiGwTitleWid)
    dashboard.addWidgets(CountWid, LatencyWid)
    dashboard.addWidgets(ErrorCountWid)

    /*
    * Kinesis
    -------------------------------------------------------------------------- */
    // Title
    const kdsTitleWid = new cw.TextWidget({
      markdown: '# Kinesis',
      height: 2,
      width: 24
    })

    const PutRecordsLatencyWid = new cw.GraphWidget({
      title: 'PutRecordsLatency(p99)',
      left: [props.dataStream.metricPutRecordsLatency()],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'p99',
      leftYAxis: { min: 0 }
    })

    const getRecordLatencyWid = new cw.GraphWidget({
      title: 'GetRecordLatency(p99)',
      left: [props.dataStream.metricGetRecordsLatency()],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'p99',
      leftYAxis: { min: 0 }
    })

    const incommingBytesPer5sMetrics = new cw.MathExpression({
      label: 'incommingBytes',
      expression: 'e1*3',
      usingMetrics: {
        e1: props.dataStream.metricIncomingBytes({ statistic: 'Max', period: Duration.minutes(1) })
      }
    })
    const incommingRecordsPer5sMetrics = new cw.MathExpression({
      label: 'incommingRecords',
      expression: 'e2*3',
      usingMetrics: {
        e2: props.dataStream.metricIncomingRecords({
          statistic: 'Max',
          period: Duration.minutes(1)
        })
      }
    })

    const writeProvisionedThroughputExceededBytesWid = new cw.GraphWidget({
      title: 'WriteProvisionedThroughputExceeded(Sum) vs IncommingBytes(Max)',
      left: [props.dataStream.metricWriteProvisionedThroughputExceeded()],
      right: [incommingBytesPer5sMetrics],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'Sum',
      leftYAxis: { min: 0 }
    })
    const writeProvisionedThroughputExceededRecordsWid = new cw.GraphWidget({
      title: 'WriteProvisionedThroughputExceeded(Sum) vs IncommigReocords(Max)',
      left: [props.dataStream.metricWriteProvisionedThroughputExceeded()],
      right: [incommingRecordsPer5sMetrics],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'Sum',
      leftYAxis: { min: 0 }
    })

    const readProvisionedThroughputExceededWid = new cw.GraphWidget({
      title: 'ReadProvisionedThroughputExceeded(Sum)',
      left: [props.dataStream.metricReadProvisionedThroughputExceeded()],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'Sum',
      leftYAxis: { min: 0 }
    })

    const putRecordsFailedRecordsWid = new cw.GraphWidget({
      title: 'PutRecordsFailedRecords(Sum): KDS Internal Error',
      left: [props.dataStream.metricPutRecordsFailedRecords()],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'Sum',
      leftYAxis: { min: 0 }
    })

    const IteratorAgeMillisecondsWid = new cw.GraphWidget({
      title: 'GetRecords.IteratorAgeMilliseconds(Avg)',
      left: [props.dataStream.metricGetRecordsIteratorAgeMilliseconds()],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'Average',
      leftYAxis: { min: 0 }
    })

    dashboard.addWidgets(kdsTitleWid)
    dashboard.addWidgets(PutRecordsLatencyWid, getRecordLatencyWid)
    dashboard.addWidgets(
      writeProvisionedThroughputExceededBytesWid,
      readProvisionedThroughputExceededWid
    )
    dashboard.addWidgets(writeProvisionedThroughputExceededRecordsWid)
    dashboard.addWidgets(putRecordsFailedRecordsWid, IteratorAgeMillisecondsWid)

    /*
    * Lambda Widgets
    -------------------------------------------------------------------------- */
    // Title
    const lambdaTitleWid = new cw.TextWidget({
      markdown: '# Lambda',
      height: 2,
      width: 24
    })

    const InvocationsWid = new cw.GraphWidget({
      title: 'Invocations(Sum)',
      left: [props.lambdaFunction.metricInvocations()],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'Sum',
      leftYAxis: { min: 0 }
    })

    const ErrorsWid = new cw.GraphWidget({
      title: 'Errors(Sum)',
      left: [props.lambdaFunction.metricErrors()],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'Sum',
      leftYAxis: { min: 0 }
    })

    const ThrottlesWid = new cw.GraphWidget({
      title: 'Throttles(Sum)',
      left: [props.lambdaFunction.metricThrottles()],
      width: defaultWidth,
      height: defaultHeight,
      statistic: 'Sum',
      leftYAxis: { min: 0 }
    })

    const DuplicatedRecordCountWId = new cw.LogQueryWidget({
      title: 'DuplicatedRecordCount(Sum)',
      logGroupNames: [`/aws/lambda/${props.lambdaFunction.functionName}`],
      view: cw.LogQueryVisualizationType.TABLE,
      queryLines: [
        'fields @message',
        'parse @message "INFO: id=" as @Info',
        'parse @message "WARNING: id=" as @Warining',
        'parse @message "ERROR: id=" as @Error',
        'stats count(@Info) as Info, count(@Warining) as Warining, count(@Error) as Error'
      ],
      width: defaultWidth
    })

    dashboard.addWidgets(lambdaTitleWid)
    dashboard.addWidgets(InvocationsWid, ErrorsWid)
    dashboard.addWidgets(ThrottlesWid, DuplicatedRecordCountWId)

    /*
    * Alerm
    -------------------------------------------------------------------------- */
  }
}
