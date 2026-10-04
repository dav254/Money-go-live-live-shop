export * from './config';
export * from './templates';
export * from './renderer';
export * from './email-provider';
export * from './email-service';
export * from './engine';

// Server-only additions (firebase-admin, crypto). Client code must import
// from the plain index (or deep modules) instead.
export * from './server-utils';
