import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { formatJSONResponse } from "@libs/api-gateway";
import { middyfy } from "@libs/lambda";
import { v4 } from "uuid";

import todosService from "src/service";

export const getAllTodos = middyfy(async (): Promise<APIGatewayProxyResult> => {
    const todos = await todosService.getAllTodos();
    return formatJSONResponse({
        todos
    });
});

export const getTodo = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const id = event.pathParameters.id;
    try {
        const todo = await todosService.getTodo(id)
        return formatJSONResponse({
            todo, id
        });
    } catch (e) {
        return formatJSONResponse({
            status: 500,
            message: e
        });
    }
});

export const createTodo = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const id = v4();
        const todo = await todosService.createTodo({
            todosId: id,
            title: event.body.name,
            description: event.body.description,
            createdAt: new Date().toISOString(),
            status: false
        });
        return formatJSONResponse({
            todo
        });
    } catch (e) {
        return formatJSONResponse({
            status: 500,
            message: e
        });
    }
});


export const updateTodo = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const id = event.pathParameters.id;
    try {
        const todo = await todosService.updateTodo(id, {
            title: event.body.name,
            description: event.body.description
        });
        return formatJSONResponse({
            todo, id
        });
    } catch (e) {
        return formatJSONResponse({
            status: 500,
            message: e
        });
    }
});

// export const deleteTodo = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
//     const id = event.pathParameters.id;
//     try {
//         const todo = await todosService.deleteTodo(id)
//         return formatJSONResponse({
//             todo, id
//         });
//     } catch (e) {
//         return formatJSONResponse({
//             status: 500,
//             message: e
//         });
//     }
// });