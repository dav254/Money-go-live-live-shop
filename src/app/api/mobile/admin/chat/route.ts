/**
 * /api/mobile/admin/chat — private chat with Qwen through Ollama.
 *
 * The phone never sees an Ollama URL or key. It sends an admin bearer token to
 * this route; the route talks to the model on the VPS loopback address.
 *
 * GET  ?id=…  — one conversation and its messages (ownership checked).
 * GET         — the admin's recent conversations.
 * POST        — send a message, persist both turns, return the real answer.
 *
 * A model failure is a 502 with a readable sentence: never a fabricated reply,
 * and never an empty assistant bubble that looks like an answer.
 */
import type { NextRequest } from 'next/server';
import {
  adminAiStoreAvailable,
  appendMessage,
  getConversation,
  listConversations,
  listMessages,
  saveConversation,
  type StoredMessage,
} from '@/lib/pocketbase/admin-ai';
import { adminGate, isStoreError, json, readBody } from '@/lib/admin-ai/http';
import { CHAT_SYSTEM_PROMPT } from '@/lib/admin-ai/instructions';
import { chatWithOllama } from '@/lib/admin-ai/ollama';
import { projectMemory } from '@/lib/admin-ai/project-memory';
import {
  cleanText,
  isSafeModelName,
  MAX_MESSAGE_CHARS,
  publicError,
  titleFromMessage,
} from '@/lib/admin-ai/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HISTORY_TURNS = 16;

function newConversationId(): string {
  return `ai_conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function newMessageId(): string {
  return `ai_msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function GET(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  if (!adminAiStoreAvailable()) {
    return json(
      {
        conversations: [],
        messages: [],
        saved: false,
        error: 'Saved chat history is unavailable — the local store is not configured on this server.',
      },
      200,
    );
  }

  const id = cleanText(request.nextUrl.searchParams.get('id'), 120);
  try {
    if (!id) {
      const conversations = await listConversations(gate.uid, 30);
      return json({ conversations, saved: true });
    }

    const conversation = await getConversation(gate.uid, id);
    if (!conversation) return json({ error: 'Conversation not found.' }, 404);
    const messages = await listMessages(id, 100);
    return json({ conversation, messages, saved: true });
  } catch (error) {
    if (!isStoreError(error)) console.error('[admin-ai/chat] read failed', error);
    return json({ error: 'Chat history could not be read.', saved: false }, 200);
  }
}

export async function POST(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  const body = await readBody(request);
  if (!body) return json({ error: 'Invalid JSON body.' }, 400);

  const message = cleanText(body.message, MAX_MESSAGE_CHARS);
  if (!message) return json({ error: 'Write a message first.' }, 400);

  const requestedId = cleanText(body.conversationId, 120);
  const requestedModel = isSafeModelName(body.model) ? body.model : null;
  const storeAvailable = adminAiStoreAvailable();

  if (requestedId && !storeAvailable) {
    return json(
      { error: 'That conversation cannot be loaded because saved history is unavailable on this server.' },
      503,
    );
  }

  let saved = storeAvailable;
  const now = new Date();
  let conversation = requestedId
    ? await getConversation(gate.uid, requestedId).catch((error) => {
        if (!isStoreError(error)) console.error('[admin-ai/chat] conversation read failed', error);
        saved = false;
        return null;
      })
    : null;

  if (requestedId && !conversation && storeAvailable) {
    return json({ error: 'Conversation not found.' }, 404);
  }

  const history: StoredMessage[] = conversation
    ? await listMessages(conversation.id, 60).catch(() => {
        saved = false;
        return [];
      })
    : [];

  const createdAt = now.toISOString();
  if (!conversation) {
    conversation = {
      id: requestedId || newConversationId(),
      title: titleFromMessage(message),
      messageCount: 0,
      createdAt,
      updatedAt: createdAt,
    };
  }

  const userMessage: StoredMessage = {
    id: newMessageId(),
    role: 'user',
    content: message,
    createdAt,
  };

  const memory = await projectMemory(gate.uid);
  const turns = [
    {
      role: 'system' as const,
      content: `${CHAT_SYSTEM_PROMPT}\n\nPROJECT MEMORY (read-only, already recorded on the server):\n${memory}`,
    },
    ...history.slice(-HISTORY_TURNS).map((entry) => ({ role: entry.role, content: entry.content })),
    { role: 'user' as const, content: message },
  ];

  let reply;
  try {
    reply = await chatWithOllama({ messages: turns, model: requestedModel });
  } catch (error) {
    // The user's message is kept so the conversation shows what was asked.
    if (saved) {
      await appendMessage({
        id: userMessage.id,
        conversationId: conversation.id,
        ownerId: gate.uid,
        message: userMessage,
      }).catch(() => {
        saved = false;
      });
    }
    const status = (error as { code?: string })?.code === 'not_configured' ? 503 : 502;
    return json({ error: publicError(error), conversation, saved }, status);
  }

  const assistantMessage: StoredMessage = {
    id: newMessageId(),
    role: 'assistant',
    content: reply.content,
    createdAt: new Date().toISOString(),
    model: reply.model,
    latencyMs: reply.latencyMs,
  };

  const nextCount = conversation.messageCount + 2;
  conversation = {
    ...conversation,
    messageCount: nextCount,
    updatedAt: assistantMessage.createdAt,
  };

  if (saved) {
    try {
      await appendMessage({
        id: userMessage.id,
        conversationId: conversation.id,
        ownerId: gate.uid,
        message: userMessage,
      });
      await appendMessage({
        id: assistantMessage.id,
        conversationId: conversation.id,
        ownerId: gate.uid,
        message: assistantMessage,
      });
      await saveConversation({ ...conversation, ownerId: gate.uid });
    } catch (error) {
      if (!isStoreError(error)) console.error('[admin-ai/chat] persist failed', error);
      saved = false;
    }
  }

  return json({
    conversation,
    messages: [...history, userMessage, assistantMessage],
    reply: assistantMessage,
    model: reply.model,
    latencyMs: reply.latencyMs,
    saved,
  });
}
