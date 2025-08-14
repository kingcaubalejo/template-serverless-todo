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

// Custom error classes for better error handling
export class TodoNotFoundError extends Error {
    constructor(todoId: string) {
        super(`Todo with id ${todoId} not found`);
        this.name = 'TodoNotFoundError';
    }
}

export class TodoValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TodoValidationError';
    }
}

export class TodoRepository {
    constructor(private readonly docClient: DynamoDBClient, private readonly tableName: string) {}
  
    // Data Mapper & Validator
    private mapFromDynamo(item: Record<string, any>): Todo {
      const parsed = TodoSchema.safeParse(unmarshall(item));
      if (!parsed.success) {
        console.warn("Invalid Todo item:", parsed.error);
        throw new TodoValidationError("Invalid data shape for Todo");
      }
      return parsed.data;
    }

    private mapToDynamo(todo: Todo): Record<string, any> {
        return {
            todosId: { S: todo.todosId },
            title: { S: todo.title },
            description: { S: todo.description },
            status: { BOOL: todo.status },
            createdAt: { S: todo.createdAt },
        };
    }
  
    async getAll(): Promise<Todo[]> {
      try {
        const result = await this.docClient.send(new ScanCommand({ TableName: this.tableName }));
        return (result.Items ?? []).map(item => this.mapFromDynamo(item));
      } catch (error) {
        console.error("Error fetching all todos:", error);
        throw new Error("Failed to fetch todos");
      }
    }

    async get(todoId: string): Promise<Todo> {
        try {
            const input = {
                ExpressionAttributeValues: {
                  ":todoId": { S: todoId }
                },
                KeyConditionExpression: "todosId = :todoId",
                TableName: this.tableName
            };
            const result = await this.docClient.send(new QueryCommand(input));
            
            if (!result.Items || result.Items.length === 0) {
                throw new TodoNotFoundError(todoId);
            }
            
            return this.mapFromDynamo(result.Items[0]);
        } catch (error) {
            if (error instanceof TodoNotFoundError) {
                throw error;
            }
            console.error("Error fetching todo:", error);
            throw new Error("Failed to fetch todo");
        }
    }

    async createTodo(todo: Todo): Promise<Todo> {
        try {
            const item: PutItemCommandInput = {
                Item: this.mapToDynamo(todo),
                TableName: this.tableName,
                ConditionExpression: "attribute_not_exists(todosId)",
                ReturnConsumedCapacity: "TOTAL"
            };
            
            await this.docClient.send(new PutItemCommand(item)) as PutItemCommandOutput;
            return todo; // Return the created todo
        } catch (error) {
            console.error("Error creating todo:", error);
            throw new Error("Failed to create todo");
        }
    }

    async updateTodo(id: string, todo: Partial<Todo>): Promise<Todo> {
        try {
            // First, get the existing todo to merge with updates
            const existingTodo = await this.get(id);
            const updatedTodo: Todo = {
                ...existingTodo,
                ...todo,
                todosId: id // Ensure ID doesn't change
            };

            const params: UpdateItemCommandInput = {
                TableName: this.tableName,
                Key: { todosId: { S: id } },
                UpdateExpression: "SET #title = :title, #description = :description, #status = :status",
                ExpressionAttributeNames: {
                    "#title": "title",
                    "#description": "description",
                    "#status": "status"
                },
                ExpressionAttributeValues: {
                    ":title": { S: updatedTodo.title },
                    ":description": { S: updatedTodo.description },
                    ":status": { BOOL: updatedTodo.status }
                },
                ConditionExpression: "attribute_exists(todosId)",
                ReturnValues: "ALL_NEW"
            };
        
            const result = await this.docClient.send(new UpdateItemCommand(params));
            return this.mapFromDynamo(result.Attributes);
        } catch (error) {
            if (error instanceof TodoNotFoundError) {
                throw error;
            }
            console.error("Error updating todo:", error);
            throw new Error("Failed to update todo");
        }
    }
    
    async deleteTodo(id: string): Promise<void> {
        try {
            const input: DeleteItemCommandInput = {
                Key: { todosId: { S: id } },
                TableName: this.tableName,
                ConditionExpression: "attribute_exists(todosId)",
                ReturnValues: "ALL_OLD"
            };
            
            await this.docClient.send(new DeleteItemCommand(input));
        } catch (error) {
            console.error("Error deleting todo:", error);
            throw new Error("Failed to delete todo");
        }
    }
}