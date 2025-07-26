import { ScanCommand, QueryCommand, PutItemCommand, PutItemCommandInput, PutItemCommandOutput } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { z } from "zod";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import Todo from '../model/Todo';

const TodoSchema = z.object({
    todosId: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.boolean(),
    createdAt: z.string(),
});

export class TodoRepository {
    constructor(private readonly docClient: DynamoDBClient, private readonly tableName: string) {}
  
    // Data Mapper & Validator
    private mapFromDynamo(item: Record<string, any>): Todo {
      const parsed = TodoSchema.safeParse(unmarshall(item));
      if (!parsed.success) {
        console.warn("Invalid Todo item:", parsed.error);
        throw new Error("Invalid data shape for Todo");
      }
      return parsed.data;
    }
  
    async getAll(): Promise<Todo[]> {
      const result = await this.docClient.send(new ScanCommand({ TableName: this.tableName }));
      return (result.Items ?? []).map(item => this.mapFromDynamo(item));
    }

    async get(todoId: string): Promise<Todo> {
        const input = {
            ExpressionAttributeValues: {
              ":a": {
                S: todoId
              }
            },
            KeyConditionExpression: "todoId = :v1",
            TableName: this.tableName
          };
      const result = await this.docClient.send(new QueryCommand(input));
      return this.mapFromDynamo(result.Items);
    }

    async createTodo(todo: Todo): Promise<any> {
        const item: PutItemCommandInput = {
            Item: {
                todosId: { S: todo.todosId } ,
                title: { S: todo.title },
                description: { S: todo.description },
                status: { BOOL: todo.status },
                createdAt: { S: todo.createdAt },
            },
            TableName: this.tableName,
            ReturnConsumedCapacity: "TOTAL",
            ReturnValues: "ALL_OLD"
        }
        const result: PutItemCommandOutput = await this.docClient.send(new PutItemCommand(item));
        return result.$metadata;
    }

  
    // Add other methods like getById, create, update, delete...
  }