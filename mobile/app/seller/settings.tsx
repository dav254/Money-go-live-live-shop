import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ImageManager } from '../../src/components/media/image-manager';
import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Button,
  ChoiceGroup,
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
import { messageFor, seller } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useAuthedResource } from '../../src/lib/use-authed';
import { BUSINESS_CATEGORIES, BUSINESS_TYPES, OFFERING_TYPES } from '../../src/lib/categories';
import { IMAGE_FOLDERS, imagePreviewUri, storedRef, type LocalImage } from '../../src/lib/media';
import {
  clean,
  validateDescription,
  validatePhone,
  validateShopName,
  validateUrl,
} from '../../src/lib/validation';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SHOP SETTINGS — edit the real storefront.
 *
 * One save writes the shop, the profile fields that mirror it (name, phone,
 * logo) and the VPS copy through `PUT /api/mobile/seller/shop`. Publishing is a
 * toggle on the same document, so a shop cannot be "published" in the app while
 * the server still considers it a draft.
 */
export default function ShopSettingsScreen() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const router = useRouter();
  const { session, refreshProfile, getToken } = useAuth();
  const { data, loading, error, reload } = useAuthedResource(
    (token) => seller.shop(token),
    [],
  );

  const record = data?.shop ?? null;

  const [shopName, setShopName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [location, setLocation] = useState('');
  const [cityTown, setCityTown] = useState('');
  const [website, setWebsite] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [offering, setOffering] = useState('');
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [offersPickup, setOffersPickup] = useState(false);
  const [operatingHours, setOperatingHours] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');
  const [published, setPublished] = useState(false);
  const [logo, setLogo] = useState<LocalImage[]>([]);
  const [cover, setCover] = useState<LocalImage[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const folder = useMemo(() => (session?.uid ? IMAGE_FOLDERS.shop(session.uid) : 'avatars'), [session?.uid]);

  // Fill the form once the storefront arrives. Keeping this in an effect (not a
  // key-based remount) means a pull-to-refresh does not wipe unsaved typing.
  useEffect(() => {
    if (!record) return;
    setShopName(record.shopName ?? '');
    setCategory(record.category ?? '');
    setDescription(record.description ?? '');
    setPhoneNumber(record.phoneNumber ?? '');
    setBusinessEmail(record.businessEmail ?? '');
    setLocation(record.location ?? '');
    setCityTown(record.cityTown ?? '');
    setWebsite(record.website ?? '');
    setBusinessType(record.businessType ?? '');
    setOffering(record.offering ?? '');
    setOffersDelivery(Boolean(record.offersDelivery));
    setOffersPickup(Boolean(record.offersPickup));
    setOperatingHours(record.operatingHours ?? '');
    setServiceAreas(record.serviceAreas ?? '');
    setPublished(Boolean(record.published));
    setLogo(
      record.logoUrl
        ? [{ key: 'logo', uri: record.logoUrl, uploadedUrl: record.logoUrl, status: 'ready' }]
        : [],
    );
    setCover(
      record.bannerUrl
        ? [{ key: 'cover', uri: record.bannerUrl, uploadedUrl: record.bannerUrl, status: 'ready' }]
        : [],
    );
  }, [record]);

  if (loading && !data) {
    return (
      <Screen>
        <SellerHeader title="Shop settings" showBack />
        <Loading label="Loading your shop…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <SellerHeader title="Shop settings" showBack />
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  const save = async () => {
    const next: Record<string, string> = {};
    const nameError = validateShopName(shopName);
    if (nameError) next.shopName = nameError;
    if (!category) next.category = 'Choose a category.';
    const descriptionError = validateDescription(description, 10);
    if (descriptionError) next.description = descriptionError;
    const phoneError = validatePhone(phoneNumber);
    if (phoneError) next.phoneNumber = phoneError;
    if (!location.trim()) next.location = 'Add your location.';
    const websiteError = validateUrl(website);
    if (websiteError) next.website = websiteError;
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setFailure(null);
    setSaved(false);
    try {
      const token = await getToken();
      await seller.saveShop(token, {
        shopName: clean(shopName),
        category,
        description: description.trim(),
        phoneNumber: clean(phoneNumber),
        businessEmail: clean(businessEmail),
        location: clean(location),
        cityTown: clean(cityTown),
        website: website.trim(),
        logoUrl: logo.length ? storedRef(logo[0]) ?? '' : '',
        bannerUrl: cover.length ? storedRef(cover[0]) ?? '' : '',
        businessType: businessType as 'physical' | 'online' | 'both',
        offering: offering as 'products' | 'services' | 'both',
        offersDelivery,
        offersPickup,
        operatingHours: clean(operatingHours),
        serviceAreas: clean(serviceAreas),
        published,
      });
      await refreshProfile();
      setSaved(true);
      reload();
    } catch (thrown) {
      setFailure(messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  const uploading = [...logo, ...cover].some((image) => image.status === 'uploading');

  return (
    <Screen>
      <SellerHeader title="Shop settings" subtitle="Business details and branding" showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionHeader title="Branding" />
        <ImageManager
          images={logo}
          onChange={setLogo}
          folder={folder}
          max={1}
          title="Shop logo"
          hint="Square, at least 400×400. Also becomes your seller avatar."
        />
        <ImageManager
          images={cover}
          onChange={setCover}
          folder={folder}
          max={1}
          title="Cover image"
          hint="A wide photo of your shop or your best products."
        />

        <SectionHeader title="Business identity" />
        <Field
          label="Shop name"
          value={shopName}
          onChangeText={setShopName}
          error={errors.shopName}
        />
        <ChoiceGroup
          label="Category"
          options={BUSINESS_CATEGORIES.map((value) => ({ value, label: value }))}
          value={category}
          onChange={setCategory}
        />
        {errors.category ? <Text style={styles.fieldError}>{errors.category}</Text> : null}
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.textarea}
          error={errors.description}
        />
        <Field
          label="Phone number"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          error={errors.phoneNumber}
        />
        <Field
          label="Business email"
          value={businessEmail}
          onChangeText={setBusinessEmail}
          keyboardType="email-address"
        />
        <Field label="Location" value={location} onChangeText={setLocation} error={errors.location} />
        <Field label="Town or city" value={cityTown} onChangeText={setCityTown} />
        <Field
          label="Website"
          value={website}
          onChangeText={setWebsite}
          autoCapitalize="none"
          error={errors.website}
        />

        <SectionHeader title="How you operate" />
        <ChoiceGroup
          label="Business type"
          options={BUSINESS_TYPES}
          value={businessType}
          onChange={setBusinessType}
        />
        <ChoiceGroup
          label="What you offer"
          options={OFFERING_TYPES}
          value={offering}
          onChange={setOffering}
        />
        <ToggleRow
          icon="bicycle-outline"
          label="Delivery available"
          value={offersDelivery}
          onValueChange={setOffersDelivery}
        />
        <ToggleRow
          icon="storefront-outline"
          label="Pickup available"
          value={offersPickup}
          onValueChange={setOffersPickup}
        />
        <Field
          label="Operating hours"
          value={operatingHours}
          onChangeText={setOperatingHours}
          placeholder="Mon–Sat, 8am–6pm"
        />
        <Field
          label="Service areas"
          value={serviceAreas}
          onChangeText={setServiceAreas}
          placeholder="Areas you deliver to or serve"
        />

        <SectionHeader title="Visibility" />
        <ToggleRow
          icon="eye-outline"
          label="Published"
          detail="Buyers can find your shop and its listings"
          value={published}
          onValueChange={setPublished}
        />

        {failure ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{failure}</Text>
          </View>
        ) : null}
        {saved ? <Muted style={{ color: colors.success }}>Saved to your shop.</Muted> : null}
        {uploading ? <Muted>Waiting for photos to finish uploading…</Muted> : null}

        <Button
          label="Save changes"
          onPress={save}
          loading={busy}
          disabled={busy || uploading}
        />
        <Muted style={styles.hint}>
          Changes are live on your public shop as soon as they are saved.
        </Muted>
        <Button
          label="Preview my shop"
          variant="outline"
          icon="eye-outline"
          onPress={() => router.push('/seller/shop')}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  textarea: { height: 110, paddingTop: spacing.md, textAlignVertical: 'top' },
  fieldError: { color: colors.danger, ...type.caption },
  errorBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(240,68,56,0.12)',
  },
  errorText: { color: colors.danger, ...type.caption },
  hint: { ...type.caption, textAlign: 'center' },
});
