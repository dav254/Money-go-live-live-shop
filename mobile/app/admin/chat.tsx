/**
 * AI CHAT — real answers from the VPS model, through the authenticated API.
 *
 * The screen holds no model address and no key. If the model is down the
 * failure is shown as a failure; no local "assistant" text is ever invented.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';

import { Badge, Body, Button, Card, Muted, Screen } from '../../src/components/ui';
import { AdminGate, ErrorCard, formatWhen, SectionLabel } from '../../src/components/admin/kit';
import { VoiceControls } from '../../src/components/admin/voice-controls';
import { colors, radius, spacing, type } from '../../src/theme';
import { adminAi, type AdminConversation, type AdminMessage, type AdminOllamaModel } from '../../src/lib/api';
import { useVoiceAssistant } from '../../src/lib/voice';

export default function AdminChatScreen() {
  return <AdminGate>{(token) => <AdminChat token={token} />}</AdminGate>;
}

function AdminChat({ token }: { token: string }) {
  const router = useRouter();
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [title, setTitle] = useState('New conversation');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [readAloud, setReadAloud] = useState(true);
  const [models, setModels] = useState<AdminOllamaModel[]>([]);
  const [model, setModel] = useState<string | null>(null);

  const voice = useVoiceAssistant({ onTranscript: (text) => setInput((prev) => (prev ? `${prev} ${text}` : text)) });

  const loadConversations = useCallback(async () => {
    try {
      const result = await adminAi.chat.conversations(token);
      setConversations(result.conversations);
      if (!result.saved && result.error) setSavedNote(result.error);
    } catch {
      /* History is a convenience; a failed list must not block a new chat. */
    }
  }, [token]);

  const loadModels = useCallback(async () => {
    try {
      const status = await adminAi.ollama(token);
      setModels(status.models);
    } catch {
      /* Model selection is optional; the server default still works. */
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
      void loadModels();
    }, [loadConversations, loadModels]),
  );

  const openConversation = useCallback(
    async (id: string) => {
      setLoadingHistory(true);
      setError(null);
      try {
        const result = await adminAi.chat.history(token, id);
        setMessages(result.messages);
        setConversationId(result.conversation.id);
        setTitle(result.conversation.title);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
      } catch (err) {
        setError((err as Error)?.message || 'That conversation could not be loaded.');
      } finally {
        setLoadingHistory(false);
      }
    },
    [token],
  );

  const startNew = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setTitle('New conversation');
    setInput('');
    setError(null);
    setSavedNote(null);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setSavedNote(null);
    setInput('');

    const optimistic: AdminMessage = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

    try {
      const result = await adminAi.chat.send(token, {
        message: text,
        ...(conversationId ? { conversationId } : {}),
        ...(model ? { model } : {}),
      });
      setMessages(result.messages);
      setConversationId(result.conversation.id);
      setTitle(result.conversation.title);
      if (!result.saved) {
        setSavedNote('The answer was received, but this conversation could not be saved on the server.');
      }
      void loadConversations();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      if (readAloud) void voice.speak(result.reply.content);
    } catch (err) {
      setError((err as Error)?.message || 'The AI request failed.');
      // Give the text back so a failed send is not lost.
      setInput(text);
      setMessages((prev) => prev.filter((message) => message.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }, [conversationId, input, loadConversations, model, readAloud, sending, token, voice]);

  const copy = useCallback(async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'The response is on your clipboard.');
  }, []);

  const toInstruction = useCallback(() => {
    if (!input.trim()) {
      router.push('/admin/instructions');
      return;
    }
    router.push({ pathname: '/admin/instructions', params: { draft: input.trim() } });
  }, [input, router]);

  const toTaskCentre = useCallback(() => {
    router.push({
      pathname: '/admin/tasks',
      params: input.trim() ? { draft: input.trim() } : {},
    });
  }, [input, router]);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.head}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Muted numberOfLines={1}>
              {conversationId ? `Conversation · ${formatWhen(messages[messages.length - 1]?.createdAt)}` : 'Not saved until the first message'}
            </Muted>
          </View>
          <Button label="NEW" variant="outline" onPress={startNew} style={{ minWidth: 78 }} />
        </View>

        <View style={styles.toolbar}>
          <View style={styles.readAloud}>
            <Ionicons
              name={readAloud ? 'volume-high-outline' : 'volume-mute-outline'}
              size={15}
              color={readAloud ? colors.primary : colors.textMuted}
            />
            <Text style={styles.readAloudText}>Read replies</Text>
            <Switch
              value={readAloud}
              onValueChange={setReadAloud}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={readAloud ? colors.primary : colors.textFaint}
            />
          </View>
          <View style={styles.toolLinks}>
            <Pressable onPress={toTaskCentre} accessibilityRole="button" style={styles.deskLink}>
              <Ionicons name="git-branch-outline" size={14} color={colors.primary} />
              <Text style={styles.deskLinkText}>TASK CENTRE</Text>
            </Pressable>
            <Pressable onPress={toInstruction} accessibilityRole="button" style={styles.deskLink}>
              <Ionicons name="terminal-outline" size={14} color={colors.primary} />
              <Text style={styles.deskLinkText}>INSTRUCTION DESK</Text>
            </Pressable>
          </View>
        </View>

        {models.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.modelStrip}
            contentContainerStyle={styles.modelContent}
          >
            <Pressable
              onPress={() => setModel(null)}
              accessibilityRole="button"
              accessibilityState={{ selected: model === null }}
              style={[styles.modelChip, model === null && styles.modelChipActive]}
            >
              <Text style={[styles.modelText, model === null && { color: colors.primary }]}>SERVER DEFAULT</Text>
            </Pressable>
            {models.map((item) => (
              <Pressable
                key={item.name}
                onPress={() => setModel(item.name)}
                accessibilityRole="button"
                accessibilityState={{ selected: model === item.name }}
                style={[styles.modelChip, model === item.name && styles.modelChipActive]}
              >
                <Text style={[styles.modelText, model === item.name && { color: colors.primary }]}>
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {conversations.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyStrip} contentContainerStyle={styles.historyContent}>
            {conversations.slice(0, 8).map((conversation) => (
              <Pressable
                key={conversation.id}
                onPress={() => void openConversation(conversation.id)}
                accessibilityRole="button"
                style={[styles.historyChip, conversation.id === conversationId && styles.historyChipActive]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.historyText, conversation.id === conversationId && { color: colors.primary }]}
                >
                  {conversation.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {loadingHistory ? (
            <View style={styles.centerRow}>
              <ActivityIndicator color={colors.primary} />
              <Muted>Loading conversation…</Muted>
            </View>
          ) : null}

          {messages.length === 0 && !loadingHistory ? (
            <Card style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
              </View>
              <Body style={{ fontWeight: '600' }}>Talk to Qwen</Body>
              <Muted style={{ textAlign: 'center', lineHeight: 19 }}>
                Ask about the codebase, draft an instruction, or request read-only diagnostics. The
                assistant cannot run anything — every change still needs your approval.
              </Muted>
              <Text style={styles.emptyHint}>Replies are spoken aloud when “Read replies” is on.</Text>
            </Card>
          ) : null}

          {messages.map((message) =>
            message.role === 'user' ? (
              <View key={message.id} style={styles.userRow}>
                <View style={styles.userBubble}>
                  <Text selectable style={styles.userText}>
                    {message.content}
                  </Text>
                </View>
              </View>
            ) : (
              <View key={message.id} style={styles.assistantBubble}>
                <View style={styles.assistantHead}>
                  <View style={styles.assistantTag}>
                    <Ionicons name="sparkles" size={12} color={colors.primary} />
                    <Text style={styles.assistantTagText}>{message.model ?? 'QWEN'}</Text>
                  </View>
                  <Pressable
                    onPress={() => void copy(message.content)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Copy response"
                    style={styles.copyBtn}
                  >
                    <Ionicons name="copy-outline" size={15} color={colors.textMuted} />
                    <Text style={styles.copyText}>COPY</Text>
                  </Pressable>
                </View>
                <Text selectable style={styles.assistantText}>
                  {message.content}
                </Text>
                <Text style={styles.messageMeta}>
                  {formatWhen(message.createdAt)}
                  {message.latencyMs ? ` · ${(message.latencyMs / 1000).toFixed(1)}s` : ''} · generated, not executed
                </Text>
              </View>
            ),
          )}

          {sending ? (
            <View style={styles.thinking}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.thinkingText}>Qwen is thinking…</Text>
            </View>
          ) : null}

          {error ? <ErrorCard message={error} onRetry={() => void send()} /> : null}
          {savedNote ? (
            <Card style={{ borderColor: 'rgba(245, 165, 36, 0.35)' }}>
              <Muted>{savedNote}</Muted>
            </Card>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <VoiceControls voice={voice} />
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask Qwen anything…"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              multiline
              maxLength={8000}
              accessibilityLabel="Message the AI assistant"
            />
            <Pressable
              onPress={() => void send()}
              disabled={sending || !input.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={[styles.send, (sending || !input.trim()) && { opacity: 0.45 }]}
            >
              <Ionicons name="send" size={19} color={colors.white} />
            </Pressable>
          </View>
          <Text style={styles.composerNote}>
            Generated text only. Nothing is executed from this screen.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { ...type.title, color: colors.text, fontSize: 20 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  readAloud: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  readAloudText: { ...type.caption, color: colors.textMuted, fontSize: 11 },
  toolLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deskLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deskLinkText: { ...type.caption, color: colors.primary, fontWeight: '800', fontSize: 10, letterSpacing: 0.6 },
  modelStrip: { maxHeight: 38, paddingLeft: spacing.lg },
  modelContent: { gap: spacing.xs, paddingRight: spacing.lg, alignItems: 'center' },
  modelChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modelChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  modelText: { ...type.caption, color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  historyStrip: { maxHeight: 42, paddingLeft: spacing.lg },
  historyContent: { gap: spacing.xs, paddingRight: spacing.lg, alignItems: 'center' },
  historyChip: {
    maxWidth: 180,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  historyChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  historyText: { ...type.caption, color: colors.textMuted, fontSize: 11 },
  messages: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, paddingVertical: spacing.xl },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHint: { ...type.caption, color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: spacing.xs },
  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '88%',
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 77, 46, 0.35)',
    borderRadius: radius.lg,
    borderBottomRightRadius: 6,
    padding: spacing.md,
  },
  userText: { ...type.body, color: colors.text, lineHeight: 21 },
  assistantBubble: {
    maxWidth: '94%',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 6,
    padding: spacing.md,
    gap: spacing.xs,
  },
  assistantHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  assistantTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  assistantTagText: { ...type.caption, color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  copyText: { ...type.caption, color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  assistantText: { ...type.body, color: colors.text, lineHeight: 22 },
  messageMeta: { ...type.caption, color: colors.textFaint, fontSize: 10 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: 2 },
  thinkingText: { ...type.caption, color: colors.textMuted },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 130,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    ...type.body,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerNote: { ...type.caption, color: colors.textFaint, fontSize: 10, textAlign: 'center' },
});
