import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'

interface DynamoDBStackProps extends StackProps {
  prefix: string
}

export class DynamoDBStack extends Stack {
  constructor(scope: Construct, id: string, props: DynamoDBStackProps) {
    super(scope, id, props)

    /*
    * DynamoDB
    -------------------------------------------------------------------------- */
    const table = new dynamodb.TableV2(this, 'Table', {
      tableName: `${props.prefix}-table`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      // sortKey: { name: 'timeStamp', type: dynamodb.AttributeType.STRING },
      // localSecondaryIndexes: [
      //   {
      //     indexName: 'userTypeIndex',
      //     sortKey: { name: 'userType', type: dynamodb.AttributeType.STRING }
      //   }
      // ],
      // globalSecondaryIndexes: [
      //   {
      //     indexName: 'emailIndex',
      //     partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      //     sortKey: { name: 'userType', type: dynamodb.AttributeType.STRING }
      //   }
      // ],
      billing: dynamodb.Billing.provisioned({
        readCapacity: dynamodb.Capacity.fixed(3),
        writeCapacity: dynamodb.Capacity.autoscaled({ maxCapacity: 5 })
      }),
      tableClass: dynamodb.TableClass.STANDARD,
      encryption: dynamodb.TableEncryptionV2.dynamoOwnedKey(),
      pointInTimeRecovery: false,
      removalPolicy: RemovalPolicy.DESTROY,
      tags: [{ key: 'Name', value: `${props.prefix}-user-table` }]
    })

    // 出力
    this.exportValue(table.tableName, { name: 'TableName' })
  }
}
