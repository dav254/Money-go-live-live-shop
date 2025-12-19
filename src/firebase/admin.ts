
// src/firebase/admin.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import * as path from 'path';
import * as fs from 'fs';

// This is no longer used, as we now use the centralized `db` from `firebase/server.ts`
// but we keep the file to avoid breaking imports that might still exist.
// A future cleanup could remove this file entirely.
