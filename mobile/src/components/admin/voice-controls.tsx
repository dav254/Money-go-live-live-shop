/**
 * Voice controls shared by Chat and the Instruction Desk.
 *
 * The microphone is a plain button with an explicit state: it is either idle
 * ("Tap to speak") or listening. The stop-speaking control only appears while
 * something is actually being read aloud, so it is never a dead button.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, type } from '../../theme';
import type { VoiceAssistant } from '../../lib/voice';

export function VoiceControls({ voice, compact = false }: { voice: VoiceAssistant; compact?: boolean }) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          if (voice.listening) voice.stopListening();
          else void voice.startListening();
        }}
        accessibilityRole="button"
        accessibilityLabel={voice.listening ? 'Stop listening' : 'Speak instead of typing'}
        accessibilityState={{ busy: voice.listening }}
        style={[styles.mic, voice.listening && styles.micActive, compact && styles.micCompact]}
      >
        <Ionicons
          name={voice.listening ? 'stop' : 'mic'}
          size={compact ? 19 : 21}
          color={voice.listening ? colors.white : colors.primary}
        />
        {compact ? null : (
          <Text style={[styles.micText, voice.listening && { color: colors.white }]}>
            {voice.listening ? 'LISTENING — TAP TO STOP' : 'TAP TO SPEAK'}
          </Text>
        )}
      </Pressable>

      {voice.speaking ? (
        <Pressable
          onPress={() => void voice.stopSpeaking()}
          accessibilityRole="button"
          accessibilityLabel="Stop speaking"
          style={styles.stop}
        >
          <Ionicons name="volume-mute" size={16} color={colors.text} />
          <Text style={styles.stopText}>STOP SPEAKING</Text>
        </Pressable>
      ) : null}

      {voice.error ? (
        <View style={styles.error}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
          <Text style={styles.errorText}>{voice.error}</Text>
          <Pressable onPress={voice.clearError} hitSlop={10} accessibilityLabel="Dismiss voice message">
            <Ionicons name="close" size={15} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  mic: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 46, 0.45)',
    backgroundColor: 'rgba(255, 77, 46, 0.08)',
    paddingHorizontal: spacing.md,
  },
  micActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  micCompact: { minHeight: 42, width: 46, paddingHorizontal: 0, borderRadius: radius.pill },
  micText: { ...type.caption, color: colors.primary, fontWeight: '800', letterSpacing: 0.6, fontSize: 11 },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  stopText: { ...type.caption, color: colors.text, fontWeight: '700', fontSize: 11, letterSpacing: 0.6 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(245, 165, 36, 0.1)',
  },
  errorText: { ...type.caption, color: colors.text, flex: 1, lineHeight: 17 },
});
