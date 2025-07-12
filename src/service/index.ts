import dynamoDBClient from "src/model/index";
import TodoService from "./service";

const todoService = new TodoService(dynamoDBClient());
export default todoService;

