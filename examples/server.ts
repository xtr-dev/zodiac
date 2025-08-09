import WebSocket, { WebSocketServer } from 'ws';
import { z, defineMessage, NodeChannel } from '../src/index.js';

// Define the same message types as the client
const addTodo = defineMessage('add-todo', z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean().default(false),
  timestamp: z.number().optional()
}));

const toggleTodo = defineMessage('toggle-todo', z.object({
  id: z.string(),
  completed: z.boolean(),
  timestamp: z.number().optional()
}));

const deleteTodo = defineMessage('delete-todo', z.object({
  id: z.string(),
  timestamp: z.number().optional()
}));

const syncTodos = defineMessage('sync-todos', z.object({
  todos: z.array(z.object({
    id: z.string(),
    text: z.string(),
    completed: z.boolean()
  })),
  timestamp: z.number().optional()
}));

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

class TodoServer {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private todos = new Map<string, Todo>();

  constructor(port: number = 8081) {
    this.wss = new WebSocketServer({ port });
    console.log(`🚀 Zodiac Todo Server starting on ws://localhost:${port}`);
    
    this.wss.on('connection', (ws) => {
      console.log('📡 New connection established');
      this.handleConnection(ws);
    });

    this.wss.on('listening', () => {
      console.log(`✅ Todo server listening on ws://localhost:${port}`);
      console.log('📝 Ready for todo list connections!');
    });
  }

  private handleConnection(ws: WebSocket) {
    this.clients.add(ws);

    // Send current todos to new client
    this.sendTodosSync(ws);

    // Handle raw messages and route them through Zodiac
    ws.on('message', async (rawData) => {
      try {
        const message = JSON.parse(rawData.toString());
        await this.handleMessage(ws, message);
      } catch (error) {
        console.error('❌ Failed to parse message:', error);
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  }

  private sendTodosSync(ws: WebSocket) {
    const todosArray = Array.from(this.todos.values());
    const syncMessage = {
      id: 'sync-todos',
      data: {
        todos: todosArray,
        timestamp: Date.now()
      }
    };
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(syncMessage));
    }
  }

  private async handleMessage(ws: WebSocket, message: any) {
    if (!this.clients.has(ws)) return;

    try {
      // Route messages based on their ID
      switch (message.id) {
        case 'add-todo':
          await this.handleAddTodo(ws, message);
          break;
        case 'toggle-todo':
          await this.handleToggleTodo(ws, message);
          break;
        case 'delete-todo':
          await this.handleDeleteTodo(ws, message);
          break;
        default:
          console.log(`🤷 Unknown message type: ${message.id}`);
      }
    } catch (error) {
      console.error('❌ Message handling error:', error);
    }
  }

  private async handleAddTodo(senderWs: WebSocket, message: any) {
    try {
      // Validate the message using our schema
      const data = addTodo.schema.parse(message.data);
      
      console.log(`➕ Adding todo: "${data.text}" (${data.id})`);
      
      // Store the todo
      this.todos.set(data.id, {
        id: data.id,
        text: data.text,
        completed: data.completed
      });
      
      // Broadcast to all connected clients
      const broadcastMessage = {
        id: 'add-todo',
        data: {
          ...data,
          timestamp: Date.now() // Server timestamp
        }
      };

      this.broadcast(broadcastMessage);
      
    } catch (error) {
      console.error('❌ Invalid add todo message:', error);
    }
  }

  private async handleToggleTodo(senderWs: WebSocket, message: any) {
    try {
      const data = toggleTodo.schema.parse(message.data);
      const todo = this.todos.get(data.id);
      
      if (todo) {
        todo.completed = data.completed;
        console.log(`✅ Toggled todo "${todo.text}": ${data.completed ? 'completed' : 'incomplete'}`);
        
        // Broadcast to all clients
        const broadcastMessage = {
          id: 'toggle-todo',
          data: {
            ...data,
            timestamp: Date.now()
          }
        };

        this.broadcast(broadcastMessage);
      }
    } catch (error) {
      console.error('❌ Invalid toggle todo message:', error);
    }
  }

  private async handleDeleteTodo(senderWs: WebSocket, message: any) {
    try {
      const data = deleteTodo.schema.parse(message.data);
      const todo = this.todos.get(data.id);
      
      if (todo) {
        console.log(`🗑️ Deleted todo: "${todo.text}" (${data.id})`);
        this.todos.delete(data.id);
        
        // Broadcast delete to all clients
        const broadcastMessage = {
          id: 'delete-todo',
          data: {
            ...data,
            timestamp: Date.now()
          }
        };

        this.broadcast(broadcastMessage);
      }
    } catch (error) {
      console.error('❌ Invalid delete todo message:', error);
    }
  }

  private handleDisconnection(ws: WebSocket) {
    this.clients.delete(ws);
    console.log(`📡 Client disconnected`);
  }

  private broadcast(message: any, excludeWs?: WebSocket) {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((ws) => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  getStats() {
    return {
      totalConnections: this.clients.size,
      totalTodos: this.todos.size,
      completedTodos: Array.from(this.todos.values()).filter(t => t.completed).length
    };
  }
}

// Start the server
const port = parseInt(process.env.PORT || '8081');
const server = new TodoServer(port);

// Log stats every 30 seconds
setInterval(() => {
  const stats = server.getStats();
  if (stats.totalConnections > 0) {
    console.log(`📊 Stats: ${stats.totalConnections} connections, ${stats.totalTodos} todos (${stats.completedTodos} completed)`);
  }
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down todo server...');
  process.exit(0);
});

export { TodoServer };