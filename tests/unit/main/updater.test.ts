import { describe, expect, it } from 'vitest';
import { summary } from '../../../src/main/updater';

describe('summary (journal des mises à jour)', () => {
  it("réduit une erreur HTTP d'electron-updater à sa première ligne et à l'URL, sans en-têtes ni cookies", () => {
    const error = [
      'Error: HttpError: 404 ',
      '"method: GET url: https://github.com/o/r/releases.atom\\n\\nPlease double check that your authentication token is correct."',
      'Headers: {',
      '  "set-cookie": [',
      '    "_gh_sess=abc; path=/; secure; HttpOnly; SameSite=Lax"',
      '  ]',
      '}',
      '    at createHttpError (httpExecutor.js:53:12)',
    ].join('\n');
    expect(summary(error)).toBe('Error: HttpError: 404 (https://github.com/o/r/releases.atom)');
  });

  it('garde les messages simples tels quels', () => {
    expect(summary('Checking for update')).toBe('Checking for update');
    expect(summary(new Error('net::ERR_INTERNET_DISCONNECTED'))).toBe('Error: net::ERR_INTERNET_DISCONNECTED');
  });
});
