import base64
from datetime import datetime, timedelta
import os
from typing import Any, List, Dict
import logging
from aws_lambda_powertools import Tracer, Logger
from aws_lambda_powertools.event_handler import (LambdaContext, LambdaEvent)
from aws_lambda_powertools.utilities.typing import LambdaContext
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key
import boto3

logger = logging.getLogger(__name__)
tracer = Tracer()
log = Logger()


kinesis_client = boto3.client('kinesis')
dynamodb_client = boto3.client('dynamodb')
dynamodb_resource = boto3.resource('dynamodb')
table_name = os.environ['TABLE_NAME']


def lambda_handler(event: LambdaEvent, context: LambdaContext) -> Any:
    tracer.capture_method(kinesis_client.put_record)
    tracer.capture_method(dynamodb_client.put_item)

    logger.info(f'Lambda Start: batch size {len(event["Records"])}')

    for record in event['Records']:
        decoded_data = base64.b64decode(record['kinesis']['data']).decode('utf-8')
        parts = decoded_data.split(',')
        id_ = parts[0]
        current_date = datetime.now()

        # DynamoDBにデータを保存
        try:
            table = dynamodb_resource.Table(table_name)
            response = table.put_item(
                Item={
                    'id': id_,
                    'eventId': record['eventID'],
                    'data': decoded_data,
                    'createdAt': current_date.timestamp(),
                    'expired': (current_date + timedelta(days=1)).timestamp()
                },
                ConditionExpression='attribute_not_exists(id)'
            )
            logger.info(f'SUCCESS: id={id_}, statusCode={response["ResponseMetadata"]["HTTPStatusCode"]}')
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                logger.warn(f'RETRY: id={id_} already exists, skipping')
                continue
            else:
                logger.error(f'FAILED: id={id_} error: {e.response["Error"]["Message"]}')
                return {
                    'batchItemFailures': [{'itemIdentifier': record['kinesis']['sequenceNumber']}]
                }

        # 他の処理を記述
        try:
            print('処理実行しました')
        except Exception as e:
            # DynamoDBからレコードを削除
            try:
                table.delete_item(Key={'id': id_})
            except ClientError as e:
                logger.error(f'Error deleting record: {e.response["Error"]["Message"]}')
            return {
                'batchItemFailures': [{'itemIdentifier': record['kinesis']['sequenceNumber']}]
            }

    logger.info('Lambda Finish')


@tracer.capture_lambda_handler
def lambda_handler(event: Dict[str, Any], context: LambdaContext) -> Any:
    return lambda_handler(event, context)


if __name__ == '__main__':
    # ここにテストコードを記述
    pass
