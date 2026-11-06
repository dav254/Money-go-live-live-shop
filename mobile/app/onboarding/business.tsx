import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ImageManager } from '../../src/components/media/image-manager';
import { RemoteImage } from '../../src/components/remote-image';
import {
  Button,
  ChoiceGroup,
  Display,
  Field,
  Heading,
  Muted,
  Notice,
  SectionHeader,
  ToggleRow,
} from '../../src/components/ui';
import { seller, messageFor } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
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

const STEPS = ['Identity', 'Appearance', 'Business', 'Review'] as const;

type Step = 0 | 1 | 2 | 3;

/**
 * SHOP ONBOARDING — four steps, each one saved to the real storefront.
 *
 * The final step publishes what has actually been written by the server, not
 * what is on screen: `PUT /api/mobile/seller/shop` is awaited, and a failure
 * leaves the seller on step 4 with the server's message. A "published" shop
 * that the backend never accepted is the one outcome this screen must not
 * produce.
 */
export default function BusinessOnboardingScreen() {
  const router = useRouter();
  const { session, refreshProfile, getToken } = useAuth();

  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [shopName, setShopName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [location, setLocation] = useState('');
  const [cityTown, setCityTown] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');

  const [logo, setLogo] = useState<LocalImage[]>([]);
  const [cover, setCover] = useState<LocalImage[]>([]);

  const [businessType, setBusinessType] = useState('');
  const [offering, setOffering] = useState('');
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [offersPickup, setOffersPickup] = useState(true);
  const [operatingHours, setOperatingHours] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');

  const uid = session?.uid ?? '';
  const folder = useMemo(() => (uid ? IMAGE_FOLDERS.shop(uid) : 'avatars'), [uid]);

  const logoRef = logo.length ? storedRef(logo[0]) : null;
  const coverRef = cover.length ? storedRef(cover[0]) : null;
  const uploading = [...logo, ...cover].some((image) => image.status === 'uploading');

  const validateStep = (current: Step): boolean => {
    const next: Record<string, string> = {};
    if (current === 0) {
      const nameError = validateShopName(shopName);
      if (nameError) next.shopName = nameError;
      if (!category) next.category = 'Choose the category that fits your business.';
      const descriptionError = validateDescription(description, 10);
      if (descriptionError) next.description = descriptionError;
      const phoneError = validatePhone(phoneNumber);
      if (phoneError) next.phoneNumber = phoneError;
      if (!phoneNumber.trim() && !businessEmail.trim()) {
        next.phoneNumber = 'Add a phone number or an email so buyers can reach you.';
      }
      if (businessEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(businessEmail.trim())) {
        next.businessEmail = 'That email address looks incomplete.';
      }
      if (!location.trim()) next.location = 'Add your location or town.';
      const websiteError = validateUrl(website);
      if (websiteError) next.website = websiteError;
    }
    if (current === 2) {
      if (!businessType) next.businessType = 'Choose how your business operates.';
      if (!offering) next.offering = 'Choose what you offer.';
      if (!offersDelivery && !offersPickup) {
        next.fulfilment = 'Choose delivery, pickup, or both.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = () => {
    if (!validateStep(step)) return;
    setError(null);
    setStep((current) => (current < 3 ? ((current + 1) as Step) : current));
  };

  const back = () => {
    if (step === 0) {
      router.back();
      return;
    }
    setStep((current) => (current - 1) as Step);
  };

  const publish = async () => {
    if (busy || uploading) return;
    for (const index of [0, 1, 2, 3] as Step[]) {
      if (!validateStep(index)) {
        setStep(index);
        return;
      }
    }

    const socialLinks = [
      instagram.trim() ? { label: 'Instagram', url: instagram.trim() } : null,
      tiktok.trim() ? { label: 'TikTok', url: tiktok.trim() } : null,
    ].filter((entry): entry is { label: string; url: string } => Boolean(entry));

    if (socialLinks.some((link) => validateUrl(link.url))) {
      setErrors({ instagram: 'Links must start with https://' });
      setStep(1);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const bearer = await getToken();
      await seller.saveShop(bearer, {
        shopName: clean(shopName),
        category,
        description: description.trim(),
        phoneNumber: clean(phoneNumber),
        businessEmail: clean(businessEmail),
        location: clean(location),
        cityTown: clean(cityTown),
        website: website.trim(),
        socialLinks,
        logoUrl: logoRef ?? '',
        bannerUrl: coverRef ?? '',
        businessType: businessType as 'physical' | 'online' | 'both',
        offering: offering as 'products' | 'services' | 'both',
        offersDelivery,
        offersPickup,
        operatingHours: clean(operatingHours),
        serviceAreas: clean(serviceAreas),
        published: true,
      });
      await refreshProfile();
      router.replace('/seller');
    } catch (thrown) {
      setError(messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          {STEPS.map((label, index) => (
            <View key={label} style={styles.progressItem}>
              <View style={[styles.progressDot, index <= step && styles.progressDotActive]}>
                {index < step ? (
                  <Ionicons name="checkmark" size={11} color={colors.white} />
                ) : (
                  <Text style={[styles.progressNumber, index === step && { color: colors.white }]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.progressLabel, index === step && { color: colors.text }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        {step === 0 ? (
          <View style={styles.section}>
            <Display>Tell us about your business</Display>
            <Muted>This is what buyers will see on your shop.</Muted>

            <Field
              label="Business or shop name"
              value={shopName}
              onChangeText={setShopName}
              placeholder="e.g. Amani Home Goods"
              autoCapitalize="words"
              error={errors.shopName}
            />
            <ChoiceGroup
              label="Business category"
              options={BUSINESS_CATEGORIES.map((value) => ({ value, label: value }))}
              value={category}
              onChange={setCategory}
            />
            {errors.category ? <Text style={styles.fieldError}>{errors.category}</Text> : null}
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="What do you sell, and what makes your shop worth visiting?"
              multiline
              numberOfLines={4}
              style={styles.textarea}
              error={errors.description}
            />
            <Field
              label="Business phone number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+254 700 000 000"
              keyboardType="phone-pad"
              error={errors.phoneNumber}
            />
            <Field
              label="Business email (optional)"
              value={businessEmail}
              onChangeText={setBusinessEmail}
              placeholder="shop@example.com"
              keyboardType="email-address"
              error={errors.businessEmail}
            />
            <Field
              label="Location"
              value={location}
              onChangeText={setLocation}
              placeholder="Area, street or landmark"
              error={errors.location}
            />
            <Field
              label="Town or city"
              value={cityTown}
              onChangeText={setCityTown}
              placeholder="Nairobi"
              autoCapitalize="words"
            />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.section}>
            <Display>Make it look like yours</Display>
            <Muted>
              A logo and a cover photo help buyers recognise your shop. You can add
              or change them later.
            </Muted>

            <ImageManager
              images={logo}
              onChange={setLogo}
              folder={folder}
              max={1}
              title="Shop logo"
              hint="Square images work best. This also becomes your seller avatar."
            />
            <ImageManager
              images={cover}
              onChange={setCover}
              folder={folder}
              max={1}
              title="Cover image"
              hint="A wide photo of your shop, products or workspace."
            />

            <SectionHeader title="Links (optional)" />
            <Field
              label="Website"
              value={website}
              onChangeText={setWebsite}
              placeholder="https://your-shop.com"
              autoCapitalize="none"
              error={errors.website}
            />
            <Field
              label="Instagram"
              value={instagram}
              onChangeText={setInstagram}
              placeholder="https://instagram.com/your-shop"
              autoCapitalize="none"
              error={errors.instagram}
            />
            <Field
              label="TikTok"
              value={tiktok}
              onChangeText={setTiktok}
              placeholder="https://tiktok.com/@your-shop"
              autoCapitalize="none"
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.section}>
            <Display>How you do business</Display>
            <Muted>Buyers use this to know how to get what they order.</Muted>

            <ChoiceGroup
              label="Your business"
              options={BUSINESS_TYPES}
              value={businessType}
              onChange={setBusinessType}
            />
            {errors.businessType ? <Text style={styles.fieldError}>{errors.businessType}</Text> : null}

            <ChoiceGroup
              label="What you offer"
              options={OFFERING_TYPES}
              value={offering}
              onChange={setOffering}
            />
            {errors.offering ? <Text style={styles.fieldError}>{errors.offering}</Text> : null}

            <ToggleRow
              icon="bicycle-outline"
              label="Delivery available"
              detail="You can deliver or arrange a courier"
              value={offersDelivery}
              onValueChange={setOffersDelivery}
            />
            <ToggleRow
              icon="storefront-outline"
              label="Pickup available"
              detail="Buyers can collect from your shop"
              value={offersPickup}
              onValueChange={setOffersPickup}
            />
            {errors.fulfilment ? <Text style={styles.fieldError}>{errors.fulfilment}</Text> : null}

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
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.section}>
            <Display>Review your shop</Display>
            <Muted>Check the details below, then publish.</Muted>

            <View style={styles.previewCard}>
              <RemoteImage
                source={cover.length ? imagePreviewUri(cover[0]) : logoRef}
                style={styles.previewCover}
                label="Shop cover preview"
              />
              <View style={styles.previewBody}>
                <RemoteImage
                  source={logo.length ? imagePreviewUri(logo[0]) : null}
                  style={styles.previewLogo}
                  radius={radius.md}
                  label="Shop logo preview"
                />
                <Heading>{shopName || 'Your shop'}</Heading>
                <Muted>{category || 'No category yet'}</Muted>
                <Text style={styles.previewDescription}>
                  {description || 'No description yet.'}
                </Text>
                <View style={styles.previewMeta}>
                  {location ? <Meta icon="location-outline" text={location} /> : null}
                  {phoneNumber ? <Meta icon="call-outline" text={phoneNumber} /> : null}
                  {offersDelivery ? <Meta icon="bicycle-outline" text="Delivery" /> : null}
                  {offersPickup ? <Meta icon="storefront-outline" text="Pickup" /> : null}
                </View>
              </View>
            </View>

            <Notice
              title="Verification is not automatic"
              body="Publishing your shop makes it public. Vidnov does not add a verified badge until the business has actually been reviewed."
            />

            {uploading ? <Muted>Waiting for photos to finish uploading…</Muted> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button label="Back" variant="ghost" onPress={back} disabled={busy} />
          {step < 3 ? (
            <Button label="Continue" onPress={next} style={{ flex: 1 }} />
          ) : (
            <Button
              label="Publish my shop"
              onPress={publish}
              loading={busy}
              disabled={busy || uploading}
              style={{ flex: 1 }}
            />
          )}
        </View>

        <Pressable
          onPress={() => router.replace('/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="Finish this later"
          style={styles.later}
        >
          <Text style={styles.laterText}>Finish this later</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={12} color={colors.textFaint} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxl * 2 },
  progress: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  progressItem: { alignItems: 'center', gap: 5, flex: 1 },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  progressNumber: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  progressLabel: { color: colors.textFaint, fontSize: 10.5, fontWeight: '600' },
  section: { gap: spacing.lg },
  textarea: { height: 110, paddingTop: spacing.md, textAlignVertical: 'top' },
  fieldError: { color: colors.danger, ...type.caption },
  previewCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  previewCover: { width: '100%', height: 120, borderRadius: 0 },
  previewBody: { padding: spacing.lg, gap: 4 },
  previewLogo: { width: 52, height: 52, marginTop: -42, marginBottom: spacing.sm },
  previewDescription: { color: colors.textMuted, ...type.body, lineHeight: 21, marginTop: 4 },
  previewMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.textMuted, ...type.caption },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  error: { color: colors.danger, ...type.caption },
  later: { alignItems: 'center', paddingVertical: spacing.md },
  laterText: { color: colors.textMuted, ...type.caption, fontWeight: '600' },
});
