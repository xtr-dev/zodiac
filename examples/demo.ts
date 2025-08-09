import { z, defineMessage, BrowserChannel } from '../src/index.js';

// Define message types for todo operations
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

// UI Elements
const statusIndicator = document.getElementById('statusIndicator')!;
const statusText = document.getElementById('statusText')!;
const wsUrlEl = document.getElementById('wsUrl') as HTMLInputElement;
const connectBtn = document.getElementById('connectBtn')!;
const connectionPanel = document.getElementById('connectionPanel')!;
const todosContainer = document.getElementById('todosContainer')!;
const emptyState = document.getElementById('emptyState')!;
const todoInputContainer = document.getElementById('todoInputContainer')!;
const todoForm = document.getElementById('todoForm') as HTMLFormElement;
const todoInput = document.getElementById('todoInput') as HTMLInputElement;
const addBtn = document.getElementById('addBtn') as HTMLButtonElement;

// Channel instance and state
let channel: BrowserChannel | null = null;
let isConnected = false;
let todos: { id: string; text: string; completed: boolean }[] = [];

// Render todos in the UI
function renderTodos() {
  if (todos.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  // Clear existing todos (except empty state)
  const todoItems = todosContainer.querySelectorAll('.todo-item');
  todoItems.forEach(item => item.remove());
  
  todos.forEach(todo => {
    const todoEl = document.createElement('div');
    todoEl.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    todoEl.innerHTML = `
      <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" data-id="${todo.id}">
        ${todo.completed ? '✓' : ''}
      </div>
      <div class="todo-text">${todo.text}</div>
      <button class="todo-delete" data-id="${todo.id}">×</button>
    `;
    
    todosContainer.appendChild(todoEl);
  });
  
  // Add event listeners
  addTodoEventListeners();
}

function addTodoEventListeners() {
  // Toggle todo completion
  document.querySelectorAll('.todo-checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const id = target.dataset.id!;
      const todo = todos.find(t => t.id === id);
      if (todo) {
        toggleTodoItem(id, !todo.completed);
      }
    });
  });
  
  // Delete todo
  document.querySelectorAll('.todo-delete').forEach(deleteBtn => {
    deleteBtn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const id = target.dataset.id!;
      deleteTodoItem(id);
    });
  });
}

// Update connection status
function updateStatus(status: 'connected' | 'disconnected' | 'connecting') {
  statusIndicator.className = `status-indicator ${status}`;
  statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  
  isConnected = status === 'connected';
  (connectBtn as HTMLButtonElement).disabled = isConnected;
  addBtn.disabled = !isConnected;
  (todoInput as HTMLInputElement).disabled = !isConnected;
  
  if (isConnected) {
    connectBtn.textContent = 'Disconnect';
    connectionPanel.classList.add('hidden');
    todoInputContainer.classList.remove('hidden');
    todoInput.focus();
  } else {
    connectBtn.textContent = 'Connect to Sync';
    (connectBtn as HTMLButtonElement).disabled = false;
    connectionPanel.classList.remove('hidden');
    todoInputContainer.classList.add('hidden');
  }
}

// Setup message handlers
function setupMessageHandlers() {
  if (!channel) return;

  // Listen for add todo events
  channel.on(addTodo, (data) => {
    const existingIndex = todos.findIndex(t => t.id === data.id);
    if (existingIndex === -1) {
      todos.push({
        id: data.id,
        text: data.text,
        completed: data.completed
      });
      renderTodos();
    }
  });

  // Listen for toggle todo events
  channel.on(toggleTodo, (data) => {
    const todo = todos.find(t => t.id === data.id);
    if (todo) {
      todo.completed = data.completed;
      renderTodos();
    }
  });

  // Listen for delete todo events
  channel.on(deleteTodo, (data) => {
    todos = todos.filter(t => t.id !== data.id);
    renderTodos();
  });

  // Listen for sync todos (initial state from server)
  channel.on(syncTodos, (data) => {
    todos = data.todos;
    renderTodos();
  });
}

// Connect to WebSocket
async function connect() {
  if (isConnected) {
    await disconnect();
    return;
  }

  try {
    updateStatus('connecting');
    emptyState.textContent = 'Connecting to server...';
    
    channel = new BrowserChannel();
    setupMessageHandlers();
    
    await channel.connect(wsUrlEl.value);
    updateStatus('connected');
    emptyState.textContent = 'Connected! Add your first todo below.';
    
  } catch (error) {
    emptyState.textContent = `Connection failed: ${error}`;
    updateStatus('disconnected');
    channel = null;
  }
}

// Disconnect from WebSocket
async function disconnect() {
  if (channel && isConnected) {
    try {
      await channel.disconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
    }
    channel = null;
  }
  updateStatus('disconnected');
  emptyState.textContent = 'Disconnected from server. Connect to sync todos.';
  todos = [];
  renderTodos();
}

// Generate unique ID for todos
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Add a new todo
async function addTodoItem() {
  if (!channel || !todoInput.value.trim()) return;
  
  try {
    const text = todoInput.value.trim();
    const id = generateId();
    
    // Add todo optimistically to local state
    todos.push({ id, text, completed: false });
    renderTodos();
    
    // Send to server with validation
    await channel.sendMessage(addTodo, {
      id,
      text,
      completed: false,
      timestamp: Date.now()
    });
    
    todoInput.value = '';
    
  } catch (error) {
    // Remove from local state if server request failed
    todos = todos.filter(t => t.text !== todoInput.value.trim());
    renderTodos();
    console.error('Add todo error:', error);
  }
}

// Toggle todo completion
async function toggleTodoItem(id: string, completed: boolean) {
  if (!channel) return;
  
  try {
    // Update local state optimistically
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.completed = completed;
      renderTodos();
    }
    
    // Send to server
    await channel.sendMessage(toggleTodo, {
      id,
      completed,
      timestamp: Date.now()
    });
    
  } catch (error) {
    // Revert local state if server request failed
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !completed;
      renderTodos();
    }
    console.error('Toggle todo error:', error);
  }
}

// Delete a todo
async function deleteTodoItem(id: string) {
  if (!channel) return;
  
  try {
    // Remove from local state optimistically
    const todoToDelete = todos.find(t => t.id === id);
    todos = todos.filter(t => t.id !== id);
    renderTodos();
    
    // Send to server
    await channel.sendMessage(deleteTodo, {
      id,
      timestamp: Date.now()
    });
    
  } catch (error) {
    // Restore local state if server request failed
    if (todoToDelete) {
      todos.push(todoToDelete);
      renderTodos();
    }
    console.error('Delete todo error:', error);
  }
}

// Event listeners
connectBtn.addEventListener('click', connect);

todoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addTodoItem();
});

todoInput.addEventListener('input', () => {
  addBtn.disabled = !todoInput.value.trim() || !isConnected;
});

// Allow Enter key to trigger connect
wsUrlEl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !(connectBtn as HTMLButtonElement).disabled) {
    connect();
  }
});

// Initialize
updateStatus('disconnected');

// Expose to window for debugging
(window as any).demo = {
  channel: () => channel,
  addTodo,
  toggleTodo,
  deleteTodo,
  syncTodos,
  todos: () => todos
};