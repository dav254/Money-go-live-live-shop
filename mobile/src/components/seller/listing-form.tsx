import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ImageManager } from '../media/image-manager';
import { RemoteImage } from '../remote-image';
import { Button, ChoiceGroup, Field, Heading, Muted, SectionHeader } from '../ui';
import { messageFor, seller } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  CURRENCIES,
  CURRENCY_DEFAULT,
  LISTING_CONDITIONS,
  PRODUCT_CATEGORIES,
  SERVICE_CATEGORIES,
} from '../../lib/categories';
import { IMAGE_FOLDERS, imagePreviewUri, storedRef, type LocalImage } from '../../lib/media';
import {
  clean,
  validateDescription,
  validatePrice,
  validateStock,
} from '../../lib/validation';
import { colors, radius, spacing, type } from '../../theme';

type Errors = Record<string, string>;

/**
 * LISTING FORM — one form, both verbs.
 *
 * Creating and editing a product or service uses the same fields and the same
 * validation, because they are the same document. On save the form uploads any
 * remaining photos first (their stored references are what get persisted),
 * then calls the server and only navigates once the write succeeded.
 *
 * The preview at the top is not decoration: it shows exactly what the catalogue
 * will draw from `imageUrl`/`price`, so a seller sees an empty-photo listing
 * before publishing it rather than after.
 */
export function ListingForm({
  listingType: initialType = 'product',
  product,
}: {
  listingType?: 'product' | 'service';
  product?: any;
}) {
  const router = useRouter();
  const { session, getToken } = useAuth();
  const editing = Boolean(product?.id);

  const [listingType, setListingType] = useState<'product' | 'service'>(
    product?.listingType === 'service' ? 'service' : initialType,
  );
  const [name, setName] = useState(String(product?.name ?? ''));
  const [category, setCategory] = useState(String(product?.category ?? ''));
  const [description, setDescription] = useState(String(product?.description ?? ''));
  const [price, setPrice] = useState(
    product?.price != null ? String(product.price) : '',
  );
  const [currency, setCurrency] = useState(
    String(product?.localCurrency ?? CURRENCY_DEFAULT).toUpperCase(),
  );
  const [wasPrice, setWasPrice] = useState(product?.wasPrice != null ? String(product.wasPrice) : '');
  const [stock, setStock] = useState(product?.stock != null ? String(product.stock) : '1');
  const [condition, setCondition] = useState<'new' | 'used'>(
    product?.condition === 'used' ? 'used' : 'new',
  );
  const [location, setLocation] = useState(String(product?.location ?? ''));
  const [delivery, setDelivery] = useState(String(product?.deliveryOptions ?? ''));
  const [tags, setTags] = useState(String(product?.tags ?? ''));

  const [images, setImages] = useState<LocalImage[]>(() => {
    const stored: string[] = Array.isArray(product?.imageUrls)
      ? product.imageUrls
      : product?.imageUrl
        ? [product.imageUrl]
        : [];
    return stored
      .filter((url): url is string => typeof url === 'string' && url.length > 0)
      .map((url, index) => ({
        key: `stored-${index}-${url}`,
        uri: url,
        uploadedUrl: url,
        status: 'ready' as const,
      }));
  });

  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const folder = useMemo(() => (session?.uid ? IMAGE_FOLDERS.product(session.uid) : 'products'), [session?.uid]);
  const uploading = images.some((image) => image.status === 'uploading');
  const categories = listingType === 'service' ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES;

  const validate = (): boolean => {
    const next: Errors = {};
    if (clean(name).length < 2) next.name = 'Give the listing a name.';
    if (!category) next.category = 'Choose a category.';
    const descriptionError = validateDescription(description, 10);
    if (descriptionError) next.description = descriptionError;
    const priceError = validatePrice(price);
    if (priceError) next.price = priceError;
    if (listingType === 'product') {
      const stockError = validateStock(stock);
      if (stockError) next.stock = stockError;
    }
    if (wasPrice.trim() && Number(wasPrice) <= Number(price)) {
      next.wasPrice = 'The “was” price must be higher than the selling price.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (busy || uploading) return;
    setFailure(null);
    if (!validate()) return;

    const refs = images.map(storedRef).filter((ref): ref is string => Boolean(ref));
    if (images.length > 0 && refs.length !== images.length) {
      setFailure('Some photos have not finished uploading. Retry them, then publish.');
      return;
    }

    setBusy(true);
    try {
      const token = await getToken();
      const body = {
        name: clean(name),
        description: description.trim(),
        category,
        listingType,
        condition,
        price: Number(price),
        currency,
        wasPrice: wasPrice.trim() ? Number(wasPrice) : null,
        stock: listingType === 'service' ? 0 : Number(stock || 0),
        location: clean(location),
        deliveryOptions: delivery.trim(),
        tags: clean(tags),
        imageUrls: refs,
      };

      if (editing) await seller.updateProduct(token, String(product.id), body);
      else await seller.createProduct(token, body);

      Alert.alert(
        editing ? 'Listing updated' : 'Listing published',
        editing
          ? 'Your changes are live in your shop and in discovery.'
          : 'It is now visible in your shop and in Vidnov discovery.',
        [{ text: 'OK', onPress: () => router.replace('/seller/products') }],
      );
    } catch (thrown) {
      setFailure(messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {/* Preview of the card the catalogue will render. */}
      <View style={styles.preview}>
        <RemoteImage
          source={images.length ? imagePreviewUri(images[0]) : null}
          style={styles.previewImage}
          label="Primary photo preview"
        />
        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={2} style={styles.previewName}>
            {clean(name) || 'Your listing name'}
          </Text>
          <Text style={styles.previewPrice}>
            {price ? `${currency} ${Number(price).toLocaleString()}` : 'Price'}
          </Text>
          <View style={styles.previewMeta}>
            <Ionicons name="location-outline" size={12} color={colors.textFaint} />
            <Text style={styles.previewLocation} numberOfLines={1}>
              {clean(location) || 'Your location'}
            </Text>
          </View>
        </View>
        <Text style={styles.previewKind}>
          {listingType === 'service' ? 'Service' : 'Product'}
        </Text>
      </View>

      <SectionHeader title="What are you listing?" />
      <ChoiceGroup
        options={[
          { value: 'product', label: 'Product' },
          { value: 'service', label: 'Service' },
        ]}
        value={listingType}
        onChange={(value) => {
          setListingType(value);
          setCategory('');
          setErrors({});
        }}
      />

      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder={listingType === 'service' ? 'e.g. Home salon braiding' : 'e.g. Handwoven basket'}
        error={errors.name}
      />

      <ChoiceGroup
        label="Category"
        options={categories.map((value) => ({ value, label: value }))}
        value={category}
        onChange={setCategory}
      />
      {errors.category ? <Text style={styles.fieldError}>{errors.category}</Text> : null}

      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Be specific: materials, sizes, what is included."
        multiline
        numberOfLines={5}
        style={styles.textarea}
        error={errors.description}
      />

      {listingType === 'product' ? (
        <ChoiceGroup
          label="Condition"
          options={LISTING_CONDITIONS.map((item) => ({ value: item.value, label: item.label }))}
          value={condition}
          onChange={setCondition}
        />
      ) : null}

      <SectionHeader title="Price and stock" />
      <Field
        label="Price"
        value={price}
        onChangeText={setPrice}
        placeholder="0"
        keyboardType="decimal-pad"
        error={errors.price}
      />
      <ChoiceGroup
        label="Currency"
        options={CURRENCIES.map((code) => ({ value: code, label: code }))}
        value={currency}
        onChange={setCurrency}
      />
      <Field
        label="Was price (optional)"
        value={wasPrice}
        onChangeText={setWasPrice}
        placeholder="Shown crossed out next to the price"
        keyboardType="decimal-pad"
        error={errors.wasPrice}
      />
      {listingType === 'product' ? (
        <Field
          label="Stock"
          value={stock}
          onChangeText={setStock}
          placeholder="How many you have"
          keyboardType="number-pad"
          error={errors.stock}
        />
      ) : null}

      <SectionHeader title="Where and how" />
      <Field
        label="Location"
        value={location}
        onChangeText={setLocation}
        placeholder="Town, area or landmark"
        autoCapitalize="words"
      />
      <Field
        label={listingType === 'service' ? 'Service area and availability' : 'Delivery details'}
        value={delivery}
        onChangeText={setDelivery}
        placeholder={
          listingType === 'service'
            ? 'e.g. Within Nairobi, weekdays 9–6'
            : 'e.g. Delivery within 2 days, pickup available'
        }
        multiline
        numberOfLines={3}
        style={styles.smallTextarea}
      />
      <Field
        label="Search tags (optional)"
        value={tags}
        onChangeText={setTags}
        placeholder="handmade, gift, cotton"
      />

      <SectionHeader title="Photos" />
      <ImageManager images={images} onChange={setImages} folder={folder} />

      {failure ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{failure}</Text>
        </View>
      ) : null}

      <Button
        label={editing ? 'Save changes' : `Publish ${listingType}`}
        onPress={submit}
        loading={busy}
        disabled={busy || uploading}
      />
      <Muted style={styles.hint}>
        Publishing makes this {listingType} visible in your shop and in discovery. You can
        unpublish or delete it at any time from Products &amp; services.
      </Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  previewImage: { width: 72, height: 72 },
  previewName: { color: colors.text, ...type.bodyStrong },
  previewPrice: { color: colors.text, ...type.body, fontWeight: '800' },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  previewLocation: { color: colors.textFaint, ...type.caption, flex: 1 },
  previewKind: { color: colors.primary, ...type.caption, fontWeight: '700' },
  textarea: { height: 120, paddingTop: spacing.md, textAlignVertical: 'top' },
  smallTextarea: { height: 84, paddingTop: spacing.md, textAlignVertical: 'top' },
  fieldError: { color: colors.danger, ...type.caption },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(240, 68, 56, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, ...type.caption, flex: 1 },
  hint: { ...type.caption, textAlign: 'center', lineHeight: 17 },
});
