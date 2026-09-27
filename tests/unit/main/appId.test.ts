import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_USER_MODEL_ID } from '../../../src/main/appId';

describe('identité Windows', () => {
  it("celle des raccourcis créés par l'installeur (appId de electron-builder.yml)", () => {
    const config = readFileSync(path.resolve(import.meta.dirname, '../../../electron-builder.yml'), 'utf8');
    expect(/^appId: (\S+)/m.exec(config)?.[1]).toBe(APP_USER_MODEL_ID);
  });
});
