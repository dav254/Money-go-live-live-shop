import React, { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Muted,
  Screen,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { commerce, messageFor } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { money, preview, shortDate } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

type Tab = 'open' | 'offers';

/**
 * REQUESTS & OFFERS — buyers describe what they need, sellers reply.
 *
 * Both lists are real records (`scope=open` briefs and this seller's own
 * offers). Submitting an offer writes to the same marketplace the website uses,
 * and the server enforces that the brief is still open and that the offer
 * belongs to the caller.
 */
export default function SellerRequestsScreen() {
  return (
    <RequireAuth>
      <Requests />
    </RequireAuth>
  );
}

function Requests() {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<Tab>('open');

  const open = useAuthedResource((token) => commerce.openRequests(token), []);
  const offers = useAuthedResource((token) => commerce.sellerOffers(token), []);

  const active = tab === 'open' ? open : offers;
  const briefs = Array.isArray(open.data?.requests) ? open.data!.requests : [];
  const mine = Array.isArray(offers.data?.offers) ? offers.data!.offers : [];

  return (
    <Screen>
      <SellerHeader title="Requests & offers" subtitle="Answer buyer briefs" showBack />

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab('open')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'open' }}
          style={[styles.tab, tab === 'open' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, tab === 'open' && { color: colors.primary }]}>
            Open briefs ({briefs.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('offers')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'offers' }}
          style={[styles.tab, tab === 'offers' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, tab === 'offers' && { color: colors.primary }]}>
            My offers ({mine.length})
          </Text>
        </Pressable>
      </View>

      {active.loading && !active.data ? (
        <Loading label={tab === 'open' ? 'Finding briefs…' : 'Loading your offers…'} />
      ) : active.error ? (
        <ErrorState message={active.error} onRetry={active.reload} />
      ) : (
        <FlatList
          data={tab === 'open' ? briefs : mine}
          keyExtractor={(item: any) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshing={active.loading}
          onRefresh={active.reload}
          renderItem={({ item }: { item: any }) =>
            tab === 'open' ? (
              <BriefCard brief={item} onSubmitted={() => {
                open.reload();
                offers.reload();
              }} getToken={getToken} />
            ) : (
              <OfferCard offer={item} />
            )
          }
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'open' ? 'document-text-outline' : 'pricetag-outline'}
              title={tab === 'open' ? 'No open briefs right now' : 'No offers sent yet'}
              body={
                tab === 'open'
                  ? 'When a buyer publishes a request that matches what you do, it appears here.'
                  : 'Offers you send on buyer briefs are listed here with their real status.'
              }
            />
          }
        />
      )}
    </Screen>
  );
}

function BriefCard({
  brief,
  onSubmitted,
  getToken,
}: {
  brief: any;
  onSubmitted: () => void;
  getToken: () => Promise<string>;
}) {
  const [openForm, setOpenForm] = useState(false);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    const amount = Number(price);
    if (!price.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFailure('Enter your price.');
      return;
    }
    if (message.trim().length < 5) {
      setFailure('Add a short note about what you can deliver.');
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const token = await getToken();
      await commerce.submitOffer(token, String(brief.id), {
        price: amount,
        message: message.trim(),
        availability: null,
        deliveryDays: null,
      });
      setOpenForm(false);
      setPrice('');
      setMessage('');
      onSubmitted();
    } catch (thrown) {
      setFailure(messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.title}>{brief.title || 'Buyer request'}</Text>
        <Badge label={String(brief.status ?? 'active')} tone="primary" />
      </View>
      <Muted>
        {brief.category || 'General'}
        {brief.location ? ` · ${brief.location}` : ''}
        {brief.deadline ? ` · by ${shortDate(brief.deadline)}` : ''}
      </Muted>
      {brief.description ? <Text style={styles.body}>{preview(brief.description, 220)}</Text> : null}
      {brief.budgetMin || brief.budgetMax ? (
        <Text style={styles.budget}>
          Budget {money(brief.budgetMin, brief.currency)} – {money(brief.budgetMax, brief.currency)}
        </Text>
      ) : null}

      {openForm ? (
        <View style={styles.form}>
          <Field
            label="Your price"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0"
          />
          <Field
            label="What you can deliver"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={3}
            style={styles.textarea}
            placeholder="Availability, delivery, what is included…"
          />
          {failure ? <Text style={styles.error}>{failure}</Text> : null}
          <View style={styles.formActions}>
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => setOpenForm(false)}
              style={{ flex: 1 }}
            />
            <Button label="Send offer" onPress={submit} loading={busy} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Button
          label="Send an offer"
          icon="pricetag-outline"
          onPress={() => setOpenForm(true)}
          variant="outline"
        />
      )}
    </View>
  );
}

function OfferCard({ offer }: { offer: any }) {
  const status = String(offer.status ?? 'pending').toLowerCase();
  const tone =
    status === 'accepted' ? 'success' : status === 'declined' ? 'danger' : 'warning';
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.title}>{offer.requestTitle || 'Offer'}</Text>
        <Badge label={status} tone={tone} />
      </View>
      <Text style={styles.budget}>
        {money(offer.price ?? offer.amount, offer.currency)}
      </Text>
      {offer.message ? <Text style={styles.body}>{preview(offer.message, 180)}</Text> : null}
      <Muted>{shortDate(typeof offer.createdAt === 'string' ? offer.createdAt : null)}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tabLabel: { color: colors.textMuted, ...type.caption, fontWeight: '600' },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { color: colors.text, ...type.bodyStrong, flex: 1 },
  body: { color: colors.textMuted, ...type.body, lineHeight: 21 },
  budget: { color: colors.text, ...type.bodyStrong, fontWeight: '800' },
  form: { gap: spacing.sm, paddingTop: spacing.sm },
  textarea: { height: 84, paddingTop: spacing.md, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', gap: spacing.sm },
  error: { color: colors.danger, ...type.caption },
});
