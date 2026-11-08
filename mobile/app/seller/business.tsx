import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Button,
  ErrorState,
  Field,
  Loading,
  Muted,
  Notice,
  Screen,
  SectionHeader,
  ToggleRow,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { useAuth } from '../../src/lib/auth';
import { messageFor, seller, type SellerShop } from '../../src/lib/api';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, spacing, type } from '../../src/theme';

/**
 * BUSINESS & LOCATION — where this shop actually works.
 *
 * The same three questions the website's `/app/seller/business` answers: which
 * area the shop is in, which areas it serves, and when it is open. They are not
 * decoration — `GET /api/nearby` finds a shop from the buyer's own area, and a
 * shop with no location is simply never returned to anyone.
 *
 * The save sends the WHOLE editable shop record, not just the changed fields:
 * `PUT /api/mobile/seller/shop` rebuilds the document from the body, so posting
 * a subset would blank everything it left out. That is also why the rest of the
 * record is carried through untouched rather than re-typed here — the full form
 * stays in Shop settings.
 */
export default function SellerBusinessScreen() {
  return (
    <RequireAuth>
      <Business />
    </RequireAuth>
  );
}

function clean(value: string): string {
  return value.trim();
}

function Business() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { data, loading, error, reload } = useAuthedResource((token) => seller.shop(token), []);

  const record: SellerShop | null = data?.shop ?? null;

  const [draft, setDraft] = useState<SellerShop | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // One copy of the record, edited in place. Every field the API reads is kept
  // so the save cannot erase what this screen does not show.
  useEffect(() => {
    if (!record) return;
    setDraft({
      shopName: record.shopName ?? '',
      category: record.category ?? '',
      description: record.description ?? '',
      phoneNumber: record.phoneNumber ?? '',
      businessEmail: record.businessEmail ?? '',
      website: record.website ?? '',
      logoUrl: record.logoUrl ?? '',
      bannerUrl: record.bannerUrl ?? '',
      businessType: record.businessType ?? '',
      offering: record.offering ?? '',
      socialLinks: record.socialLinks ?? [],
      location: record.location ?? '',
      cityTown: record.cityTown ?? '',
      county: record.county ?? '',
      serviceAreas: record.serviceAreas ?? '',
      operatingHours: record.operatingHours ?? '',
      offersDelivery: Boolean(record.offersDelivery),
      offersPickup: Boolean(record.offersPickup),
      published: Boolean(record.published),
    });
  }, [record]);

  const set = <K extends keyof SellerShop>(key: K, value: SellerShop[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!draft) return;
    if (!clean(draft.location ?? '')) {
      setFailure('Add the area your shop works from — without it, buyers nearby cannot find you.');
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const token = await getToken();
      await seller.saveShop(token, {
        shopName: draft.shopName ?? '',
        category: draft.category ?? '',
        description: draft.description ?? '',
        phoneNumber: draft.phoneNumber ?? '',
        businessEmail: draft.businessEmail ?? '',
        website: draft.website ?? '',
        logoUrl: draft.logoUrl ?? '',
        bannerUrl: draft.bannerUrl ?? '',
        businessType: draft.businessType ?? '',
        offering: draft.offering ?? '',
        socialLinks: draft.socialLinks ?? [],
        location: clean(draft.location ?? ''),
        cityTown: clean(draft.cityTown ?? ''),
        county: clean(draft.county ?? ''),
        serviceAreas: clean(draft.serviceAreas ?? ''),
        operatingHours: clean(draft.operatingHours ?? ''),
        offersDelivery: Boolean(draft.offersDelivery),
        offersPickup: Boolean(draft.offersPickup),
        published: Boolean(draft.published),
      });
      Alert.alert('Saved', 'Your business location is updated. Buyers nearby can now find this shop.');
      reload();
    } catch (thrown) {
      setFailure(messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !draft) {
    return (
      <Screen>
        <SellerHeader title="My business" showBack />
        <Loading label="Reading your shop record…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <SellerHeader title="My business" showBack />
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  if (!draft) {
    return (
      <Screen>
        <SellerHeader title="My business" showBack />
        <View style={styles.content}>
          <Notice
            title="No shop yet"
            body="This account has no shop record, so there is no location to set. Set the shop up first — the app never creates a half-filled shop behind your back."
          />
          <Button label="Shop settings" variant="outline" onPress={() => router.push('/seller/settings')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <SellerHeader title="My business" subtitle="Where you work, and when" showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Notice
          title="This is what Nearby uses"
          body="Buyers see an area name and a distance — never your exact address. A shop with no area here is not returned by Nearby at all."
        />

        <SectionHeader title="Where you work" />
        <Field
          label="Area or street"
          placeholder="e.g. Ngara, opposite the market"
          value={draft.location ?? ''}
          onChangeText={(value) => set('location', value)}
          autoCapitalize="words"
        />
        <Field
          label="Town or city"
          placeholder="e.g. Nairobi"
          value={draft.cityTown ?? ''}
          onChangeText={(value) => set('cityTown', value)}
          autoCapitalize="words"
        />
        <Field
          label="County"
          placeholder="e.g. Nairobi"
          value={draft.county ?? ''}
          onChangeText={(value) => set('county', value)}
          autoCapitalize="words"
        />

        <SectionHeader title="How buyers reach you" />
        <Field
          label="Service areas"
          placeholder="Areas you deliver or travel to, comma separated"
          value={draft.serviceAreas ?? ''}
          onChangeText={(value) => set('serviceAreas', value)}
          autoCapitalize="sentences"
          multiline
        />
        <Field
          label="Opening hours"
          placeholder="e.g. Mon–Sat 8:00–18:00"
          value={draft.operatingHours ?? ''}
          onChangeText={(value) => set('operatingHours', value)}
          autoCapitalize="sentences"
        />
        <ToggleRow
          label="Offers delivery"
          detail="Buyers can ask for the item to be brought to them."
          value={Boolean(draft.offersDelivery)}
          onValueChange={(next) => set('offersDelivery', next)}
          icon="bicycle-outline"
        />
        <ToggleRow
          label="Offers pickup"
          detail="Buyers can collect from your area."
          value={Boolean(draft.offersPickup)}
          onValueChange={(next) => set('offersPickup', next)}
          icon="bag-handle-outline"
        />
        <ToggleRow
          label="Shop is published"
          detail="Unpublished shops keep their listings but drop out of public surfaces."
          value={Boolean(draft.published)}
          onValueChange={(next) => set('published', next)}
          icon="eye-outline"
        />

        {failure ? <Text style={styles.failure}>{failure}</Text> : null}

        <Button
          label={busy ? 'Saving…' : 'Save location'}
          onPress={save}
          loading={busy}
          disabled={busy}
          icon="checkmark-circle-outline"
        />
        <Button
          label="Full shop settings"
          variant="ghost"
          onPress={() => router.push('/seller/settings')}
        />

        <Muted style={styles.footnote}>
          Name, description, photos and social links stay in Shop settings. This screen only writes
          the fields Nearby and delivery read.
        </Muted>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  failure: { color: colors.danger, ...type.caption },
  footnote: { marginTop: spacing.sm },
});
