import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { z, defineMessage } from '../src/index.js';

test('defineMessage - creates message definition with correct structure', () => {
  const userMessage = defineMessage('user-message', z.object({
    name: z.string(),
    age: z.number()
  }));

  assert.equal(userMessage.id, 'user-message');
  assert.ok(userMessage.schema);
  assert.ok(userMessage.messageSchema);

  const validData = { name: 'Alice', age: 25 };
  const validatedData = userMessage.schema.parse(validData);
  assert.deepEqual(validatedData, validData);

  const validMessage = {
    id: 'user-message' as const,
    data: { name: 'Bob', age: 30 },
    timestamp: 123456
  };
  const validatedMessage = userMessage.messageSchema.parse(validMessage);
  assert.deepEqual(validatedMessage, validMessage);
});


test('Type inference - properly infers message data types', () => {
  const userMessage = defineMessage('user', z.object({
    name: z.string(),
    email: z.string().email(),
    age: z.number()
  }));

  const validData = { name: 'Alice', email: 'alice@example.com', age: 25 };
  const result = userMessage.schema.parse(validData);
  assert.deepEqual(result, validData);

  const completeMessage = {
    id: 'user' as const,
    data: { name: 'Bob', email: 'bob@example.com', age: 30 },
    timestamp: Date.now()
  };
  const validatedMessage = userMessage.messageSchema.parse(completeMessage);
  assert.equal(validatedMessage.id, 'user');
  assert.equal(validatedMessage.data.name, 'Bob');
  assert.equal(validatedMessage.data.age, 30);
});