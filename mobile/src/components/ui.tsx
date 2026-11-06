import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { HIT, colors, radius, spacing, type } from '../theme';
import { apiUrl } from '../lib/config';

/* ── Layout ──────────────────────────────────────────────────────────────── */

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

export function ScrollScreen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

/* ── Text ────────────────────────────────────────────────────────────────── */

type Textish = TextProps & { children: React.ReactNode; style?: any };

export function Title({ children, style, ...rest }: Textish) {
  return (
    <Text style={[styles.title, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Display({ children, style, ...rest }: Textish) {
  return (
    <Text style={[styles.display, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Heading({ children, style, ...rest }: Textish) {
  return (
    <Text style={[styles.heading, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Body({ children, style, ...rest }: Textish) {
  return (
    <Text style={[styles.body, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Muted({ children, style, ...rest }: Textish) {
  return (
    <Text style={[styles.muted, style]} {...rest}>
      {children}
    </Text>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

/* ── Surfaces ────────────────────────────────────────────────────────────── */

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'primary' && styles.badgePrimary,
        tone === 'success' && styles.badgeSuccess,
        tone === 'warning' && styles.badgeWarning,
        tone === 'danger' && styles.badgeDanger,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          tone === 'primary' && { color: colors.primary },
          tone === 'success' && { color: colors.success },
          tone === 'warning' && { color: colors.warning },
          tone === 'danger' && { color: colors.danger },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/** A tappable settings/detail row — one shape for every list of links. */
export function ListRow({
  icon,
  title,
  detail,
  onPress,
  tone = 'default',
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  detail?: string;
  onPress?: () => void;
  tone?: 'default' | 'danger';
}) {
  const content = (
    <>
      {icon ? (
        <View style={styles.listIcon}>
          <Ionicons name={icon} size={18} color={tone === 'danger' ? colors.danger : colors.textMuted} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.listTitle, tone === 'danger' && { color: colors.danger }]}>{title}</Text>
        {detail ? <Text style={styles.listDetail}>{detail}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={17} color={colors.textFaint} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.listRow}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.surfaceRaised }]}
    >
      {content}
    </Pressable>
  );
}

/** A labelled on/off setting — used for delivery, pickup and visibility. */
export function ToggleRow({
  label,
  detail,
  value,
  onValueChange,
  icon,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.toggleRow}>
      {icon ? (
        <View style={styles.listIcon}>
          <Ionicons name={icon} size={18} color={colors.textMuted} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>{label}</Text>
        {detail ? <Text style={styles.listDetail}>{detail}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: 'rgba(255,77,46,0.45)' }}
        thumbColor={value ? colors.primary : colors.textFaint}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** A single-choice group rendered as tappable chips. */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | '';
  onChange: (next: T) => void;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            active={value === option.value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * An honest explanatory panel. Used where a capability is genuinely not
 * available yet — never as decoration, and never to replace a working screen.
 */
export function Notice({
  title,
  body,
  tone = 'neutral',
  icon = 'information-circle-outline',
}: {
  title: string;
  body: string;
  tone?: 'neutral' | 'warning';
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.notice, tone === 'warning' && styles.noticeWarning]}>
      <Ionicons
        name={icon}
        size={18}
        color={tone === 'warning' ? colors.warning : colors.textMuted}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Text style={styles.listDetail}>{body}</Text>
      </View>
    </View>
  );
}

/** One number on a dashboard, with an honest caption. */
export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'primary' | 'warning' | 'danger';
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text
        style={[
          styles.statValue,
          tone === 'primary' && { color: colors.primary },
          tone === 'warning' && { color: colors.warning },
          tone === 'danger' && { color: colors.danger },
        ]}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </>
  );

  if (!onPress) return <View style={styles.statTile}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.statTile, pressed && { opacity: 0.85 }]}
    >
      {content}
    </Pressable>
  );
}

export function Price({ amount, currency, style }: { amount?: number | null; currency?: string | null; style?: any }) {
  if (amount == null || !Number.isFinite(amount)) {
    return <Text style={[styles.price, style]}>Ask for a quote</Text>;
  }
  const code = (currency || '').toUpperCase();
  return (
    <Text style={[styles.price, style]}>
      {code ? `${code} ` : ''}
      {amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </Text>
  );
}

export function Avatar({ uri, name, size = 44 }: { uri?: string | null; name?: string | null; size?: number }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (uri) {
    // Avatars are stored media references too — resolve before drawing.
    return (
      <Image
        source={{ uri: apiUrl(uri) }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  );
}

/* ── Controls ────────────────────────────────────────────────────────────── */

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
        variant === 'outline' && styles.buttonOutline,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && { backgroundColor: colors.danger },
        isDisabled && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? colors.text : colors.white} />
      ) : (
        <Row style={{ gap: spacing.sm }}>
          {icon ? <Ionicons name={icon} size={18} color={variant === 'outline' || variant === 'ghost' ? colors.text : colors.white} /> : null}
          <Text
            style={[
              styles.buttonLabel,
              (variant === 'outline' || variant === 'ghost') && { color: colors.text },
            ]}
          >
            {label}
          </Text>
        </Row>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[styles.input, error ? { borderColor: colors.danger } : null, style]}
        autoCapitalize="none"
        {...props}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} accessibilityRole="button" style={styles.iconButton} hitSlop={8}>
      <Ionicons name={name} size={22} color={colors.text} />
      {badge && badge > 0 ? (
        <View style={styles.iconBadge}>
          <Text style={styles.iconBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ── States ──────────────────────────────────────────────────────────────── */

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.stateBlock}>
      <ActivityIndicator color={colors.primary} />
      <Muted>{label}</Muted>
    </View>
  );
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  body,
  action,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.stateBlock}>
      <View style={styles.stateIcon}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Heading>{title}</Heading>
      <Muted style={{ textAlign: 'center' }}>{body}</Muted>
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.stateBlock}>
      <View style={[styles.stateIcon, { backgroundColor: 'rgba(240, 68, 56, 0.14)' }]}>
        <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
      </View>
      <Heading>That didn’t load</Heading>
      <Muted style={{ textAlign: 'center' }}>{message}</Muted>
      {onRetry ? <Button label="Try again" onPress={onRetry} variant="outline" icon="refresh" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
  display: { color: colors.text, ...type.display },
  title: { color: colors.text, ...type.title },
  heading: { color: colors.text, ...type.heading },
  body: { color: colors.text, ...type.body },
  muted: { color: colors.textMuted, ...type.body },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { color: colors.text, ...type.heading },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  badgePrimary: { backgroundColor: colors.primarySoft },
  badgeDanger: { backgroundColor: 'rgba(240, 68, 56, 0.16)' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: { color: colors.text, ...type.bodyStrong },
  listDetail: { color: colors.textFaint, ...type.caption, marginTop: 2 },
  badgeSuccess: { backgroundColor: 'rgba(47, 191, 113, 0.16)' },
  badgeWarning: { backgroundColor: 'rgba(245, 165, 36, 0.16)' },
  badgeText: { color: colors.textMuted, ...type.caption },
  price: { color: colors.text, fontSize: 16, fontWeight: '700' },
  avatar: { backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  button: {
    minHeight: HIT,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonLabel: { color: colors.white, fontSize: 15.5, fontWeight: '700' },
  label: { color: colors.textMuted, ...type.caption },
  input: {
    minHeight: HIT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    fontSize: 15.5,
  },
  fieldError: { color: colors.danger, ...type.caption },
  chip: {
    paddingHorizontal: spacing.lg,
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.textMuted, ...type.caption, fontWeight: '600' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  iconBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  iconBadgeText: { color: colors.white, fontSize: 9.5, fontWeight: '800' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: HIT,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  noticeWarning: { borderColor: 'rgba(245,165,36,0.4)' },
  noticeTitle: { color: colors.text, ...type.caption, fontWeight: '700' },
  statTile: {
    flexGrow: 1,
    minWidth: '45%',
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 3,
  },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  statLabel: { color: colors.textMuted, ...type.caption, fontWeight: '600' },
  statHint: { color: colors.textFaint, fontSize: 11.5, lineHeight: 15 },
  stateBlock: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  stateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
