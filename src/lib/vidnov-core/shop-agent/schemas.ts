/**
 * SHOP OPPORTUNITY AGENT — request validation (zod).
 *
 * Route-level wire formats only: bounded strings, closed enums, id shapes.
 * Scores, evidence, stages and suppression reasons are NEVER accepted from a
 * client as data — they are computed or enumerated server-side, so no
 * schema here can inject one.
 */

import { z } from 'zod';
import { DOC_ID_PATTERN } from '../types';
import { CANDIDATE_STAGES, CONTACT_KINDS, DEFAULT_CATEGORIES } from './types';

const idSchema = z.string().regex(DOC_ID_PATTERN, 'Invalid id.');

export const manualLeadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().max(40),
  area: z.string().trim().max(60).optional(),
  website: z.string().trim().max(200).optional(),
  contact: z
    .object({
      kind: z.enum([...CONTACT_KINDS]),
      value: z.string().trim().min(3).max(200),
    })
    .optional(),
  evidence: z.array(z.string().trim().max(200)).max(5).optional(),
});

export const scoutRequestSchema = z.object({
  action: z.enum(['places', 'manual']).default('places'),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().min(0.5).max(50).optional(),
  categories: z.array(z.enum([...DEFAULT_CATEGORIES])).max(DEFAULT_CATEGORIES.length).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  lead: manualLeadSchema.optional(),
});

export const candidateQuerySchema = z.object({
  stage: z.enum([...CANDIDATE_STAGES]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const candidatePatchSchema = z.object({
  action: z.enum(['approve', 'reject', 'advance', 'suppress', 'analyze', 'link']),
  note: z.string().trim().max(300).optional(),
  stage: z.enum([...CANDIDATE_STAGES]).optional(),
  uid: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
  reason: z.enum(['manual', 'complaint']).optional(),
});

export const packageActionSchema = z.object({
  action: z.enum(['generate', 'poster']),
  candidateId: idSchema,
  /** Paid AI generation requires an explicit human confirmation flag. */
  confirm: z.boolean().optional(),
});

export const messageActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'send']),
  ids: z.array(idSchema).min(1).max(100).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const campaignPatchSchema = z.object({
  paused: z.boolean().optional(),
  complianceAcknowledged: z.boolean().optional(),
  senderName: z.string().trim().max(60).optional(),
  dailyMessageLimit: z.number().int().min(0).max(200).optional(),
  dailyBudgetMinor: z.number().int().min(0).max(10_000_000).optional(),
});

export const optOutSchema = z.object({
  candidate: idSchema,
  token: z.string().min(8).max(80),
});

export type ScoutRequestBody = z.infer<typeof scoutRequestSchema>;
export type CandidatePatchBody = z.infer<typeof candidatePatchSchema>;
export type PackageActionBody = z.infer<typeof packageActionSchema>;
export type MessageActionBody = z.infer<typeof messageActionSchema>;
