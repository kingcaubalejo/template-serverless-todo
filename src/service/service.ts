import Todo from '../model/Todo';
import { TodoRepository } from "src/repository/todo.repository";

export default class TodoService {
    constructor(private readonly repo: TodoRepository) {}

    async getAllTodos(): Promise<Todo[]> {
        const todos = await this.repo.getAll();
        return todos;
    }

    async getTodo(id: string): Promise<Todo> {
        const todo = await this.repo.get(id);
        return todo;
    }

    async createTodo(todo: Todo): Promise<Todo> {
        const item = await this.repo.createTodo(todo);
        return item;
    }



    async updateTodo(id: string, todo: Partial<Todo>): Promise<Todo> {
        const updated = await this.repo.updateTodo(id, todo);
        return updated;
    }

    // async deleteTodo(id: string): Promise<any> {
    //     return await this.docClient.delete({
    //         TableName: this.Tablename,
    //         Key: {
    //             todosId: id
    //         }
    //     }).promise();
    // }
}