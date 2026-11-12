/**
 * Shared controls for the native admin Operations screens.
 *
 * The section strip is the mobile counterpart of the web console's sidebar:
 * every marketplace section is one tap away, while Intelligence and Developer
 * stay separate because they depend on the VPS model/agent connection.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { colors, radius, spacing, type } from '../../theme';

export type AdminOpsNavKey =
  | 'home'
  | 'users'
  | 'sellers'
  | 'market'
  | 'finance'
  | 'safety'
  | 'growth'
  | 'intelligence'
  | 'developer';

export const ADMIN_SECTIONS: Array<{
  key: AdminOpsNavKey;
  label: string;
  href: '/admin' | '/admin/users' | '/admin/sellers' | '/admin/market' | '/admin/finance' | '/admin/safety' | '/admin/growth' | '/admin/intelligence' | '/admin/developer';
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'home', label: 'Home', href: '/admin', icon: 'grid-outline' },
  { key: 'users', label: 'Users', href: '/admin/users', icon: 'people-outline' },
  { key: 'sellers', label: 'Sellers', href: '/admin/sellers', icon: 'storefront-outline' },
  { key: 'market', label: 'Market', href: '/admin/market', icon: 'bag-handle-outline' },
  { key: 'finance', label: 'Finance', href: '/admin/finance', icon: 'cash-outline' },
  { key: 'safety', label: 'Safety', href: '/admin/safety', icon: 'shield-checkmark-outline' },
  { key: 'growth', label: 'Growth', href: '/admin/growth', icon: 'trending-up-outline' },
  { key: 'intelligence', label: 'Intelligence', href: '/admin/intelligence', icon: 'sparkles-outline' },
  { key: 'developer', label: 'Developer', href: '/admin/developer', icon: 'terminal-outline' },
];

export function AdminSectionNav({ active }: { active: AdminOpsNavKey }) {
  const router = useRouter();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.navContent}
      style={styles.nav}
    >
      {ADMIN_SECTIONS.map((section) => {
        const selected = section.key === active;
        return (
          <Pressable
            key={section.key}
            onPress={() => router.push(section.href)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Open ${section.label}`}
            style={[styles.navItem, selected && styles.navItemActive]}
          >
            <Ionicons
              name={section.icon}
              size={14}
              color={selected ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.navLabel, selected && styles.navLabelActive]}>
              {section.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function AdminSearch({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.search}>
      <Ionicons name="search-outline" size={17} color={colors.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={17} color={colors.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function AdminPageTitle({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

export function money(value: number, currency = 'USD'): string {
  return `${currency === 'USD' ? '$' : `${currency} `}${value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return '—';
  return new Date(at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function statusTone(status: string): 'neutral' | 'primary' | 'success' | 'warning' | 'danger' {
  const value = status.toLowerCase();
  if (['active', 'verified', 'completed', 'delivered', 'published', 'approved', 'live'].includes(value)) {
    return 'success';
  }
  if (['suspended', 'failed', 'rejected', 'cancelled', 'disputed', 'unpublished'].includes(value)) {
    return 'danger';
  }
  if (['pending', 'processing', 'investigating', 'draft', 'unknown', 'paid'].includes(value)) {
    return 'warning';
  }
  if (['shipped', 'packed', 'delivery', 'emailed', 'copied'].includes(value)) return 'primary';
  return 'neutral';
}

const styles = StyleSheet.create({
  nav: { flexGrow: 0, marginHorizontal: -spacing.lg },
  navContent: { gap: spacing.xs, paddingHorizontal: spacing.lg },
  navItem: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  navItemActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  navLabel: { ...type.caption, color: colors.textMuted, fontWeight: '600' },
  navLabelActive: { color: colors.primary, fontWeight: '700' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, color: colors.text, ...type.body, paddingVertical: 10 },
  titleBlock: { gap: 3 },
  eyebrow: {
    ...type.caption,
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: { ...type.title, color: colors.text },
  detail: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
});
