/**
 * INSTRUCTION DESK.
 *
 * Submit an instruction, read the real report, copy both. The one thing this
 * screen will never do is claim the instruction ran: the server stores
 * `executed:false`, the UI repeats it, and the report itself carries the note.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Badge, Button, Card, Muted, Screen } from '../../src/components/ui';
import {
  AdminGate,
  ErrorCard,
  formatWhen,
  NotExecutedBanner,
  SectionLabel,
} from '../../src/components/admin/kit';
import { ReportView, reportToText } from '../../src/components/admin/report-view';
import { VoiceControls } from '../../src/components/admin/voice-controls';
import { colors, radius, spacing, type } from '../../src/theme';
import { adminAi, type AdminReport } from '../../src/lib/api';
import { useVoiceAssistant } from '../../src/lib/voice';

export default function InstructionsScreen() {
  return <AdminGate>{(token) => <InstructionDesk token={token} />}</AdminGate>;
}

function InstructionDesk({ token }: { token: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ draft?: string }>();
  const [instruction, setInstruction] = useState(typeof params.draft === 'string' ? params.draft : '');
  const [report, setReport] = useState<AdminReport | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const appliedDraft = useRef<string | null>(null);

  const voice = useVoiceAssistant({
    onTranscript: (text) => setInstruction((prev) => (prev ? `${prev} ${text}` : text)),
  });

  useEffect(() => {
    if (typeof params.draft !== 'string' || !params.draft.trim()) return;
    if (appliedDraft.current === params.draft) return;
    appliedDraft.current = params.draft;
    setInstruction(params.draft);
  }, [params.draft]);

  const send = useCallback(async () => {
    const text = instruction.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setReport(null);
    setSaved(null);
    try {
      const result = await adminAi.instructions.send(token, text);
      setReport(result.report);
      setSaved(result.saved);
    } catch (err) {
      setError((err as Error)?.message || 'The instruction could not be sent.');
    } finally {
      setSending(false);
    }
  }, [instruction, sending, token]);

  const copyInstruction = useCallback(async () => {
    await Clipboard.setStringAsync(instruction.trim());
    Alert.alert('Copied', 'The instruction is on your clipboard.');
  }, [instruction]);

  const copyReport = useCallback(async () => {
    if (!report) return;
    await Clipboard.setStringAsync(reportToText(report));
    Alert.alert('Copied', 'The complete report is on your clipboard.');
  }, [report]);

  const shareReport = useCallback(async () => {
    if (!report) return;
    await Share.share({ message: reportToText(report), title: report.title });
  }, [report]);

  const newTask = useCallback(() => {
    setInstruction('');
    setReport(null);
    setError(null);
    setSaved(null);
    appliedDraft.current = null;
  }, []);

  const canSend = instruction.trim().length > 0 && !sending;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <NotExecutedBanner text="The Instruction Desk asks the model for a written report. It does not read files, change code, install software, deploy or restart anything." />

        <SectionLabel>INSTRUCTION</SectionLabel>
        <Card style={{ gap: spacing.sm }}>
          <TextInput
            value={instruction}
            onChangeText={setInstruction}
            placeholder="Paste or write a technical instruction for Qwen…"
            placeholderTextColor={colors.textFaint}
            style={styles.instructionInput}
            multiline
            textAlignVertical="top"
            maxLength={24000}
            accessibilityLabel="Instruction for the AI"
          />
          <View style={styles.inputFoot}>
            <Text style={styles.counter}>{instruction.length.toLocaleString()} / 24,000</Text>
            <Text style={styles.inputHint}>Report only · nothing executed</Text>
          </View>
        </Card>

        <VoiceControls voice={voice} />

        <View style={styles.actions}>
          <Button
            label={sending ? 'SENDING…' : 'SEND INSTRUCTION'}
            icon="send-outline"
            loading={sending}
            disabled={!canSend}
            onPress={() => void send()}
          />
          <View style={styles.actionRow}>
            <Button
              label="COPY INSTRUCTION"
              variant="outline"
              icon="copy-outline"
              onPress={() => void copyInstruction()}
              disabled={!instruction.trim()}
              style={{ flex: 1 }}
            />
            <Button
              label="NEW TASK"
              variant="outline"
              icon="add-outline"
              onPress={newTask}
              style={{ flex: 1 }}
            />
          </View>
          <View style={styles.actionRow}>
            <Button
              label="COPY REPORT"
              variant="outline"
              icon="document-text-outline"
              onPress={() => void copyReport()}
              disabled={!report}
              style={{ flex: 1 }}
            />
            <Button
              label="SHARE REPORT"
              variant="outline"
              icon="share-outline"
              onPress={() => void shareReport()}
              disabled={!report}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {sending ? (
          <Card style={styles.progress}>
            <ActivityIndicator color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.progressTitle}>Generating report…</Text>
              <Text style={styles.progressBody}>
                Waiting for the model on the Vidnov server. No task is running in the background.
              </Text>
            </View>
          </Card>
        ) : null}

        {error ? <ErrorCard message={error} onRetry={() => void send()} /> : null}

        {report ? (
          <View style={{ gap: spacing.md }}>
            <View style={styles.resultHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultLabel}>LATEST REPORT</Text>
                <Text style={styles.resultTitle}>Generated {formatWhen(report.completedAt ?? report.startedAt)}</Text>
              </View>
              <Badge label={report.status.toUpperCase()} tone={report.status === 'completed' ? 'success' : 'danger'} />
            </View>

            {report.status === 'failed' ? (
              <Card style={{ borderColor: 'rgba(240, 68, 56, 0.4)', gap: 4 }}>
                <Text style={styles.progressTitle}>The report could not be generated</Text>
                <Text style={styles.errorText}>
                  {report.error ?? 'The model did not return a usable answer.'}
                </Text>
                <Text style={styles.progressBody}>
                  The attempt is kept in Task Reports. Nothing was executed.
                </Text>
              </Card>
            ) : null}

            {saved === false ? (
              <Card style={{ borderColor: 'rgba(245, 165, 36, 0.35)' }}>
                <Muted>
                  This report was generated but could not be saved to the server’s history. Copy it
                  now if you need to keep it.
                </Muted>
              </Card>
            ) : null}

            <ReportView report={report} onCopy={() => void copyReport()} onShare={() => void shareReport()} />

            <Pressable onPress={() => router.push('/admin/reports')} style={styles.linkRow} accessibilityRole="button">
              <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              <Text style={styles.linkText}>OPEN TASK REPORTS</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.primary} />
            </Pressable>
          </View>
        ) : !sending && !error ? (
          <Card style={styles.empty}>
            <Ionicons name="document-outline" size={26} color={colors.textFaint} />
            <Muted style={{ textAlign: 'center', lineHeight: 19 }}>
              No report yet. Send an instruction and the model’s full answer will appear here, with
              the instruction, model, timings, verification plan and next step.
            </Muted>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  instructionInput: {
    minHeight: 170,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    padding: spacing.md,
    ...type.body,
    lineHeight: 22,
  },
  inputFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  inputHint: { ...type.caption, color: colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  actions: { gap: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  progressTitle: { ...type.bodyStrong, color: colors.text },
  progressBody: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  errorText: { ...type.caption, color: colors.danger, lineHeight: 18 },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  resultLabel: { ...type.caption, color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  resultTitle: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  linkText: { ...type.caption, color: colors.primary, fontWeight: '800', fontSize: 11, letterSpacing: 0.6 },
});
