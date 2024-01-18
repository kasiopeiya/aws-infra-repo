[https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis-example.html](https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis-example.html)

## Lambda作成
```
aws lambda create-function --function-name ProcessKinesisRecords \
--zip-file fileb://function.zip --handler index.handler --runtime nodejs18.x \
--role arn:aws:iam::134161968696:role/lambda-kinesis-role
```
```
~/dev/aws-cdk/infra-repo/resources/tutorial/kinesis_data_streams $ aws lambda create-function --function-name ProcessKinesisRecords \
--zip-file fileb://function.zip --handler index.handler --runtime nodejs18.x \
--role arn:aws:iam::134161968696:role/lambda-kinesis-role
{
    "FunctionName": "ProcessKinesisRecords",
    "FunctionArn": "arn:aws:lambda:ap-northeast-1:134161968696:function:ProcessKinesisRecords",
    "Runtime": "nodejs18.x",
    "Role": "arn:aws:iam::134161968696:role/lambda-kinesis-role",
    "Handler": "index.handler",
    "CodeSize": 554,
    "Description": "",
    "Timeout": 3,
    "MemorySize": 128,
    "LastModified": "2024-01-02T00:43:40.487+0000",
    "CodeSha256": "vlqowA/EjqvUTU0qPZaN4Qt0pHEFEUz4MLNobCCNGis=",
    "Version": "$LATEST",
    "TracingConfig": {
        "Mode": "PassThrough"
    },
    "RevisionId": "c0d8bb93-1d63-4d5c-91d7-c972e47fd9b9",
    "State": "Pending",
    "StateReason": "The function is being created.",
    "StateReasonCode": "Creating",
    "PackageType": "Zip",
    "Architectures": [
        "x86_64"
    ]
}
```

## Test Lambda
```
aws lambda invoke --function-name ProcessKinesisRecords \
--cli-binary-format raw-in-base64-out \
--payload file://input.txt outputfile.txt
```
```
~/dev/aws-cdk/infra-repo/resources/tutorial/kinesis_data_streams $ aws lambda invoke --function-name ProcessKinesisRecords \
--cli-binary-format raw-in-base64-out \
--payload file://input.txt outputfile.txt
{
    "StatusCode": 200,
    "ExecutedVersion": "$LATEST"
}
```

## Create Kinesis Stream
```
aws kinesis create-stream --stream-name lambda-stream --shard-count 1
aws kinesis describe-stream --stream-name lambda-stream
```
```
~/dev/aws-cdk/infra-repo/resources/tutorial/kinesis_data_streams $ aws kinesis describe-stream --stream-name lambda-stream
{
    "StreamDescription": {
        "Shards": [
            {
                "ShardId": "shardId-000000000000",
                "HashKeyRange": {
                    "StartingHashKey": "0",
                    "EndingHashKey": "340282366920938463463374607431768211455"
                },
                "SequenceNumberRange": {
                    "StartingSequenceNumber": "49647920668008031036537220918821362586678899019805097986"
                }
            }
        ],
        "StreamARN": "arn:aws:kinesis:ap-northeast-1:134161968696:stream/lambda-stream",
        "StreamName": "lambda-stream",
        "StreamStatus": "ACTIVE",
        "RetentionPeriodHours": 24,
        "EnhancedMonitoring": [
            {
                "ShardLevelMetrics": []
            }
        ],
        "EncryptionType": "NONE",
        "KeyId": null,
        "StreamCreationTimestamp": "2024-01-02T09:48:29+09:00"
    }
}
```

## Add an event source in Lambda
```
aws lambda create-event-source-mapping --function-name ProcessKinesisRecords \
--event-source  arn:aws:kinesis:ap-northeast-1:134161968696:stream/lambda-stream \
--batch-size 100 --starting-position LATEST
```
```
~/dev/aws-cdk/infra-repo/resources/tutorial/kinesis_data_streams $ aws lambda create-event-source-mapping --function-name ProcessKinesisRecords \
--event-source  arn:aws:kinesis:ap-northeast-1:134161968696:stream/lambda-stream \
--batch-size 100 --starting-position LATEST
{
    "UUID": "aee6e45b-a191-401a-a768-98b897290b20",
    "StartingPosition": "LATEST",
    "BatchSize": 100,
    "MaximumBatchingWindowInSeconds": 0,
    "ParallelizationFactor": 1,
    "EventSourceArn": "arn:aws:kinesis:ap-northeast-1:134161968696:stream/lambda-stream",
    "FunctionArn": "arn:aws:lambda:ap-northeast-1:134161968696:function:ProcessKinesisRecords",
    "LastModified": "2024-01-02T09:50:51.795000+09:00",
    "LastProcessingResult": "No records processed",
    "State": "Creating",
    "StateTransitionReason": "User action",
    "DestinationConfig": {
        "OnFailure": {}
    },
    "MaximumRecordAgeInSeconds": -1,
    "BisectBatchOnFunctionError": false,
    "MaximumRetryAttempts": -1,
    "TumblingWindowInSeconds": 0,
    "FunctionResponseTypes": []
}
```

```
aws lambda list-event-source-mappings --function-name ProcessKinesisRecords \
--event-source arn:aws:kinesis:ap-northeast-1:134161968696:stream/lambda-stream
```
```
~/dev/aws-cdk/infra-repo/resources/tutorial/kinesis_data_streams $ aws lambda list-event-source-mappings --function-name ProcessKinesisRecords \
--event-source arn:aws:kinesis:ap-northeast-1:134161968696:stream/lambda-stream
{
    "EventSourceMappings": [
        {
            "UUID": "aee6e45b-a191-401a-a768-98b897290b20",
            "StartingPosition": "LATEST",
            "BatchSize": 100,
            "MaximumBatchingWindowInSeconds": 0,
            "ParallelizationFactor": 1,
            "EventSourceArn": "arn:aws:kinesis:ap-northeast-1:134161968696:stream/lambda-stream",
            "FunctionArn": "arn:aws:lambda:ap-northeast-1:134161968696:function:ProcessKinesisRecords",
            "LastModified": "2024-01-02T09:51:00+09:00",
            "LastProcessingResult": "No records processed",
            "State": "Enabled",
            "StateTransitionReason": "User action",
            "DestinationConfig": {
                "OnFailure": {}
            },
            "MaximumRecordAgeInSeconds": -1,
            "BisectBatchOnFunctionError": false,
            "MaximumRetryAttempts": -1,
            "TumblingWindowInSeconds": 0,
            "FunctionResponseTypes": []
        }
    ]
}
```

## Test
```
```
