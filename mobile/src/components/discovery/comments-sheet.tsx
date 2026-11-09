import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../ui';
import { catalog, messageFor, type ListingComment } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fonts, premium, radius, spacing } from '../../theme';

/**
 * COMMENTS — the thread under a listing.
 *
 * Reads and writes `products/{id}/comments`, the collection the website's post
 * already uses, through the mobile routes. Nothing is counted locally: the
 * number shown is the number of rows the server returned.
 */
export function CommentsSheet({
  listingId,
  visible,
  onClose,
  onCount,
}: {
  listingId: string | null;
  visible: boolean;
  onClose: () => void;
  onCount?: (count: number) => void;
}) {
  const { status, getToken } = useAuth();
  const [comments, setComments] = useState<ListingComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await catalog.comments(listingId);
      const rows = Array.isArray(result?.comments) ? result.comments : [];
      setComments(rows);
      onCount?.(rows.length);
    } catch (thrown) {
      setError(messageFor(thrown));
    } finally {
      setLoading(false);
    }
  }, [listingId, onCount]);

  useEffect(() => {
    if (visible && listingId) void load();
  }, [visible, listingId, load]);

  const send = async () => {
    const body = text.trim();
    if (!body || !listingId || posting) return;
    if (status !== 'signedIn') {
      setError('Sign in to comment.');
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const token = await getToken();
      const result = await catalog.comment(token, listingId, body);
      const added = result?.comment;
      setComments((prev) => {
        const next = added ? [...prev, added] : prev;
        onCount?.(next.length);
        return next;
      });
      setText('');
    } catch (thrown) {
      setError(messageFor(thrown));
    } finally {
      setPosting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close comments" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Text style={styles.title}>Comments</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close comments">
              <Ionicons name="close" size={20} color={premium.textMuted} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={premium.brand} />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 360 }}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.empty}>
                  No comments yet. Ask the seller a question — they get it as a notification.
                </Text>
              }
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Avatar uri={item.userAvatar} name={item.userName} size={30} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.author}>{item.userName}</Text>
                    <Text style={styles.body}>{item.text}</Text>
                  </View>
                </View>
              )}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={status === 'signedIn' ? 'Add a comment…' : 'Sign in to comment'}
              placeholderTextColor={premium.textMuted}
              style={styles.input}
              maxLength={500}
              editable={status === 'signedIn' && !posting}
              multiline
            />
            <Pressable
              onPress={send}
              disabled={!text.trim() || posting}
              style={[styles.send, !text.trim() || posting ? styles.sendDisabled : null]}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
            >
              {posting ? (
                <ActivityIndicator color={premium.text} size="small" />
              ) : (
                <Ionicons name="arrow-up" size={18} color={premium.text} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: premium.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
    paddingBottom: spacing.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: premium.border,
    marginTop: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: premium.text, fontFamily: fonts.heading, fontSize: 16, fontWeight: '700' },
  center: { paddingVertical: spacing.xxl, alignItems: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  empty: {
    color: premium.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    textAlign: 'center',
    lineHeight: 19,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  author: { color: premium.text, fontFamily: fonts.bodySemi, fontSize: 12.5 },
  body: { color: premium.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  error: { color: premium.brand, fontFamily: fonts.body, fontSize: 12, paddingHorizontal: spacing.lg },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  input: {
    flex: 1,
    maxHeight: 96,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: premium.border,
    backgroundColor: premium.raised,
    color: premium.text,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.body,
    fontSize: 13.5,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: premium.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: premium.raised },
});
