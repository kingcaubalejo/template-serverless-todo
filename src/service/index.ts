import dynamodbClient from "src/model/index";

import TodoService from "./service";
import { TodoRepository } from "src/repository/todo.repository";

const todoService = new TodoService(new TodoRepository(dynamodbClient, "TodosTable"));
export default todoService;

