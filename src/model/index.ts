import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const dynamodbClient = () : DynamoDBClient => {
  if (process.env.IS_OFFLINE) {
    return new DynamoDBClient({
      region: "localhost",
      endpoint: "http://localhost:8000",
    })
  }

  return new DynamoDBClient();
}
const docClient = DynamoDBDocumentClient.from(dynamodbClient());
export default docClient;