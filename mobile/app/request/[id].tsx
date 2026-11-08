import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Badge,
  Button,
  Display,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Muted,
  Notice,
  Price,
  Screen,
  SectionHeader,
} from '../../src/components/ui';
import { RemoteImage } from '../../src/components/remote-image';
import { useAuth } from '../../src/lib/auth';
import { commerce, messageFor } from '../../src/lib/api';
import { shortDate, titleCase } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * ONE REQUEST — the buyer's brief, its offers, and the accept decision.
 *
 * Everything here is the existing marketplace API, not a mobile-only copy:
 *   GET   /api/requests?id=…                the brief + its private media
 *   GET   /api/requests/offers?requestId=…  offers (owner-only, enforced server-side)
 *   PATCH /api/requests?action=accept|decline|close
 *
 * Accepting an offer is what CREATES THE ORDER — the server does that in one
 * step, so the app never fabricates an order id or a success screen.
 */
export default function RequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const requestId = typeof id === 'string' ? id : '';
  const { profile, getToken } = useAuth();
  const [busyOffer, setBusyOffer] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const detail = useAuthedResource((token) => commerce.request(token, requestId), [requestId], {
    enabled: Boolean(requestId),
  });

  const request = detail.data?.request ?? null;
  const isOwner = Boolean(request && profile?.uid && request.customerId === profile.uid);
  const isOpen = request?.status === 'active';

  const offers = useAuthedResource(
    (token) => commerce.offersForRequest(token, requestId),
    [requestId],
    { enabled: Boolean(requestId) && isOwner },
  );

  const refreshAll = useCallback(() => {
    detail.reload();
    offers.reload();
  }, [detail, offers]);

  const decide = (offer: any, action: 'accept' | 'decline') => {
    const price = typeof offer.price === 'number' ? offer.price : null;
    Alert.alert(
      action === 'accept' ? 'Accept this offer?' : 'Decline this offer?',
      action === 'accept'
        ? `This creates an order at ${offer.currency || ''} ${price ?? '—'} with ${
            offer.sellerBusinessName || offer.sellerName || 'this seller'
          }. The other offers stay on the brief.`
        : 'The seller is told you passed. The brief stays open for other offers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'accept' ? 'Accept' : 'Decline',
          style: action === 'accept' ? 'default' : 'destructive',
          onPress: () => void run(offer, action),
        },
      ],
    );
  };

  const run = async (offer: any, action: 'accept' | 'decline') => {
    if (!requestId || !offer?.id) return;
    setBusyOffer(offer.id);
    setActionError(null);
    try {
      const token = await getToken();
      const result =
        action === 'accept'
          ? await commerce.acceptOffer(token, requestId, offer.id)
          : await commerce.declineOffer(token, requestId, offer.id);
      offers.reload();
      detail.reload();
      if (action === 'accept') {
        const orderId = (result as { orderId?: string })?.orderId;
        Alert.alert(
          'Offer accepted',
          orderId
            ? 'The order is created. You can follow it in My orders.'
            : 'The order is created. You can follow it in My orders.',
          [{ text: 'View orders', onPress: () => router.push('/orders') }, { text: 'Stay' }],
        );
      }
    } catch (error) {
      setActionError(messageFor(error));
    } finally {
      setBusyOffer(null);
    }
  };

  const closeBrief = () => {
    Alert.alert('Close this brief?', 'Sellers can no longer send offers. It stays in your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close brief',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken();
            await commerce.closeRequest(token, requestId);
            detail.reload();
          } catch (error) {
            setActionError(messageFor(error));
          }
        },
      },
    ]);
  };

  if (!requestId) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Request not found" body="This link is missing a request id." />
      </Screen>
    );
  }

  if (detail.loading && !detail.data) {
    return (
      <Screen>
        <Loading label="Loading the request…" />
      </Screen>
    );
  }

  if (detail.error && !detail.data) {
    return (
      <Screen>
        <ErrorState message={detail.error} onRetry={detail.reload} />
      </Screen>
    );
  }

  if (!request) {
    return (
      <Screen>
        <EmptyState
          icon="document-text-outline"
          title="Request unavailable"
          body="It may have been removed, or it belongs to another account."
        />
      </Screen>
    );
  }

  const media: any[] = Array.isArray(detail.data?.media) ? detail.data!.media : [];
  const offerList: any[] = Array.isArray(offers.data?.offers) ? offers.data!.offers : [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: spacing.sm }}>
          <View style={styles.headerRow}>
            <Display style={{ flex: 1 }}>{request.title || 'Request'}</Display>
            <Badge
              label={titleCase(String(request.status || 'active'))}
              tone={isOpen ? 'primary' : 'neutral'}
            />
          </View>
          <View style={styles.metaRow}>
            {request.requestNumber ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{request.requestNumber}</Text>
              </View>
            ) : null}
            {request.category ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{request.category}</Text>
              </View>
            ) : null}
            {request.location ? (
              <View style={styles.chip}>
                <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                <Text style={styles.chipText}>{request.location}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Muted>{request.description || 'No description was added.'}</Muted>
          <View style={styles.detailGrid}>
            <Detail label="Budget" value={
              request.budgetMin || request.budgetMax
                ? `${request.currency || ''} ${request.budgetMin ?? '—'} – ${request.budgetMax ?? '—'}`
                : 'Open'
            } />
            <Detail label="Fulfilment" value={titleCase(String(request.fulfilment || 'either'))} />
            <Detail label="Quantity" value={String(request.quantity ?? 1)} />
            <Detail label="Posted" value={request.createdAt ? shortDate(String(request.createdAt)) : '—'} />
          </View>
        </View>

        {media.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Attachments" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {media.map((item) => (
                <RemoteImage
                  key={String(item.id || item.url)}
                  source={item.thumbnailUrl || item.url}
                  style={styles.media}
                  radius={radius.md}
                  label="Request attachment"
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {!isOwner ? (
          <Notice
            title="This is another buyer's brief"
            body="Only the buyer who posted it can see or answer its offers."
          />
        ) : null}

        {isOwner ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader
              title={`Offers${offerList.length ? ` (${offerList.length})` : ''}`}
              action={isOpen ? <Button label="Close brief" variant="ghost" onPress={closeBrief} /> : undefined}
            />

            {actionError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{actionError}</Text>
              </View>
            ) : null}

            {offers.loading && !offers.data ? <Loading label="Loading offers…" /> : null}

            {offers.error && !offers.data ? (
              <ErrorState message={offers.error} onRetry={offers.reload} />
            ) : null}

            {!offers.loading && !offers.error && offerList.length === 0 ? (
              <EmptyState
                icon="pricetag-outline"
                title="No offers yet"
                body={
                  isOpen
                    ? 'Matched sellers have been notified. Offers appear here as they arrive.'
                    : 'This brief is closed, so no new offers will arrive.'
                }
                action={<Button label="Refresh" variant="outline" onPress={refreshAll} />}
              />
            ) : null}

            {offerList.map((offer) => {
              const status = String(offer.status || 'submitted');
              const pending = status === 'submitted' && isOpen;
              return (
                <View key={String(offer.id)} style={styles.offerCard}>
                  <View style={styles.offerHeader}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Heading style={{ fontSize: 15 }}>
                        {offer.sellerBusinessName || offer.sellerName || 'Vidnov seller'}
                      </Heading>
                      <Muted>
                        {offer.deliveryDays ? `Ready in ~${offer.deliveryDays} day(s)` : 'Timing not stated'}
                        {offer.availability ? ` · ${offer.availability}` : ''}
                      </Muted>
                    </View>
                    <Price amount={offer.price} currency={offer.currency} />
                  </View>

                  {offer.message ? <Muted>{offer.message}</Muted> : null}

                  <View style={styles.offerFooter}>
                    <Badge
                      label={titleCase(status)}
                      tone={
                        status === 'accepted'
                          ? 'success'
                          : status === 'declined' || status === 'withdrawn'
                            ? 'neutral'
                            : 'primary'
                      }
                    />
                    {offer.createdAt ? <Muted>{shortDate(String(offer.createdAt))}</Muted> : null}
                  </View>

                  <View style={styles.offerActions}>
                    <Button
                      label="Message"
                      variant="outline"
                      icon="chatbubble-outline"
                      onPress={() => router.push(`/chat/new:${offer.sellerId}`)}
                      style={{ flex: 1 }}
                    />
                    {pending ? (
                      <>
                        <Button
                          label="Decline"
                          variant="ghost"
                          loading={busyOffer === offer.id}
                          onPress={() => decide(offer, 'decline')}
                          style={{ flex: 1 }}
                        />
                        <Button
                          label="Accept"
                          loading={busyOffer === offer.id}
                          onPress={() => decide(offer, 'accept')}
                          style={{ flex: 1 }}
                        />
                      </>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexBasis: '48%', gap: 2 }}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipText: { color: colors.textMuted, ...type.caption, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  detailLabel: { color: colors.textMuted, ...type.caption },
  detailValue: { color: colors.text, ...type.body, fontWeight: '600' },
  media: { width: 160, height: 120, backgroundColor: colors.surfaceRaised },
  offerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  offerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  offerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  offerActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(240, 68, 56, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, ...type.caption, flex: 1 },
});
