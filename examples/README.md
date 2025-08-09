# Zodiac Examples

This directory contains examples demonstrating how to use Zodiac.

## Interactive Todo List Demo

The `index.html` file provides a beautiful todo list interface that showcases:

- Type-safe message definitions using `defineMessage()`
- Real-time WebSocket communication
- Runtime validation with Zod schemas  
- Clean API using `channel.on()` and `channel.sendMessage()`
- Modern todo list UI with real-time synchronization

### Running the Todo List Demo

```bash
# Start both todo server and web client together
npm run example

# Or run separately:
npm run example:backend   # Start WebSocket todo server on ws://localhost:8081
npm run example:frontend  # Start web client on available port
```

The `example` command starts both the WebSocket server and web client together for a complete multi-user todo list experience!

### Todo List Features

🎨 **Modern Todo Interface**
- Clean, responsive todo list design that works on mobile and desktop
- Real-time connection status indicators
- Smooth animations and hover effects
- Optimistic UI updates with rollback on errors

📝 **Type-Safe Todo Operations**
- Automatic todo validation before sending
- Full TypeScript support with IntelliSense
- Real-time multi-user synchronization
- Error handling and display

### Message Types Demonstrated

1. **Add Todo**
   ```typescript
   const addTodo = defineMessage('add-todo', z.object({
     id: z.string(),
     text: z.string(),
     completed: z.boolean().default(false),
     timestamp: z.number().optional()
   }));
   ```

2. **Toggle Todo**
   ```typescript
   const toggleTodo = defineMessage('toggle-todo', z.object({
     id: z.string(),
     completed: z.boolean(),
     timestamp: z.number().optional()
   }));
   ```

3. **Type-Safe Message Handling**
   ```typescript
   channel.on(addTodo, (data, message) => {
     // data.id, data.text, data.completed are fully typed
     todos.push({ id: data.id, text: data.text, completed: data.completed });
   });
   ```

### Testing Multi-User Todo List

The demo now includes a real WebSocket todo server with multi-user support:

1. **Start Server** - Run `npm run example` to start both server and client
2. **Connect** - Click "Connect to Sync" to join (defaults to `ws://localhost:8081`)
3. **Add Todos** - Type a todo item and press Enter or click "Add"
4. **Toggle/Delete** - Click checkboxes to toggle completion, hover and click × to delete
5. **Multi-User** - Open multiple browser tabs to test real-time synchronization between users
6. **Test Validation** - Open dev tools to see type checking and validation in action

### Server Features

The included WebSocket server (`examples/server.ts`) demonstrates:

- **Multi-user todo synchronization** - Real-time todo operation broadcasting to all connected users
- **Type-safe message handling** - Uses the same Zodiac definitions as the client
- **Persistent state** - Server maintains the authoritative todo list state
- **Message validation** - Server-side Zod schema validation
- **Connection stats** - Logs user connections and todo statistics
- **Graceful shutdown** - Proper cleanup on server stop

The todo interface automatically handles:
- Real-time synchronization across all connected clients
- Optimistic UI updates with server confirmation
- Connection status updates
- Error display and handling
- Automatic state sync for new connections

## Additional Examples

For more examples of using Zodiac in different scenarios, check out the live todo demo which showcases the complete library functionality with real-time WebSocket communication.