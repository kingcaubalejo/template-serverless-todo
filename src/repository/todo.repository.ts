import { ScanCommand, QueryCommand, PutItemCommand, PutItemCommandInput, PutItemCommandOutput, UpdateItemCommand, UpdateItemCommandInput, UpdateItemCommandOutput, DeleteItemCommand, DeleteItemCommandOutput, DeleteItemCommandInput } from "@aws-sdk/client-dynamodb";
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
              ":todoId": {
                S: todoId
              }
            },
            KeyConditionExpression: "todosId = :todoId",
            TableName: this.tableName
          };
      const result = await this.docClient.send(new QueryCommand(input));
      return this.mapFromDynamo(result.Items[0]);
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

    async updateTodo(id: string, todo: Partial<Todo>): Promise<any> {
      const params: UpdateItemCommandInput = {
        TableName: this.tableName,
        Key: {
          todosId: { S: id },
        },
        UpdateExpression: "SET #title = :name, #description = :description",
        ExpressionAttributeNames: {
          "#title": "title",
          "#description": "description",
        },
        ExpressionAttributeValues: {
          ":name": { S: todo.title }, 
          ":description": { S: todo.description },
        },
        ReturnValues: "ALL_NEW", 
      };
    
      try {
        const command = new UpdateItemCommand(params);
        const data: UpdateItemCommandOutput = await this.docClient.send(command);
        console.info("Item updated successfully:", data);
        return data;
      } catch (error) {
        console.error("Error updating item:", error);
        throw error;
      }
    }
    
    async deleteTodo(id: string): Promise<any> {
      const input: DeleteItemCommandInput = {
        Key: {
          todosId: {
            S: id
          },
        },
        TableName: this.tableName
      };
      const command = new DeleteItemCommand(input);
      const response: DeleteItemCommandOutput = await this.docClient.send(command);
      return response;
    }
    // Add other methods like getById, create, update, delete...
  }