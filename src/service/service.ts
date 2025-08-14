import Todo from '../model/Todo';
import { TodoRepository, TodoNotFoundError, TodoValidationError } from "src/repository/todo.repository";

// Business logic validation
export class TodoValidationService {
    static validateTodo(todo: Partial<Todo>): void {
        if (todo.title && todo.title.trim().length === 0) {
            throw new TodoValidationError("Title cannot be empty");
        }
        if (todo.title && todo.title.length > 100) {
            throw new TodoValidationError("Title cannot exceed 100 characters");
        }
        if (todo.description && todo.description.length > 500) {
            throw new TodoValidationError("Description cannot exceed 500 characters");
        }
    }

    static validateTodoId(id: string): void {
        if (!id || id.trim().length === 0) {
            throw new TodoValidationError("Todo ID is required");
        }
    }
}

export default class TodoService {
    constructor(private readonly repo: TodoRepository) {}

    async getAllTodos(): Promise<Todo[]> {
        try {
            const todos = await this.repo.getAll();
            return todos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } catch (error) {
            console.error("Service error in getAllTodos:", error);
            throw error;
        }
    }

    async getTodo(id: string): Promise<Todo> {
        try {
            TodoValidationService.validateTodoId(id);
            const todo = await this.repo.get(id);
            return todo;
        } catch (error) {
            console.error("Service error in getTodo:", error);
            throw error;
        }
    }

    async createTodo(todoData: Omit<Todo, 'todosId' | 'createdAt' | 'status'>): Promise<Todo> {
        try {
            TodoValidationService.validateTodo(todoData);
            
            const todo: Todo = {
                ...todoData,
                todosId: this.generateTodoId(),
                createdAt: new Date().toISOString(),
                status: false,
            };

            const createdTodo = await this.repo.createTodo(todo);
            return createdTodo;
        } catch (error) {
            console.error("Service error in createTodo:", error);
            throw error;
        }
    }

    async updateTodo(id: string, todoData: Partial<Todo>): Promise<Todo> {
        try {
            TodoValidationService.validateTodoId(id);
            TodoValidationService.validateTodo(todoData);
            
            // Remove fields that shouldn't be updated
            const { todosId, createdAt, ...updateData } = todoData;
            
            const updatedTodo = await this.repo.updateTodo(id, updateData);
            return updatedTodo;
        } catch (error) {
            console.error("Service error in updateTodo:", error);
            throw error;
        }
    }

    async deleteTodo(id: string): Promise<void> {
        try {
            TodoValidationService.validateTodoId(id);
            await this.repo.deleteTodo(id);
        } catch (error) {
            console.error("Service error in deleteTodo:", error);
            throw error;
        }
    }

    async toggleTodoStatus(id: string): Promise<Todo> {
        try {
            TodoValidationService.validateTodoId(id);
            
            const existingTodo = await this.repo.get(id);
            const updatedTodo = await this.repo.updateTodo(id, {
                status: !existingTodo.status
            });
            
            return updatedTodo;
        } catch (error) {
            console.error("Service error in toggleTodoStatus:", error);
            throw error;
        }
    }

    private generateTodoId(): string {
        return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}