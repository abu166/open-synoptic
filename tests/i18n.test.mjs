import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translate, setLanguage, apiLanguage, localizedDate } from '../src/i18n/locale.ts';
import { catalog } from '../src/i18n/messages.ts';

test('all catalog translations preserve interpolation slots in both languages', () => {
  const slots = (text) => [...text.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort();
  for (const [key, values] of Object.entries(catalog)) {
    for (const value of values) assert.deepEqual(slots(value), slots(key), key);
  }
  const rows = readFileSync(new URL('../src/i18n/catalog.tsv', import.meta.url), 'utf8').trim().split('\n').filter((line) => line.trim());
  assert.equal(rows.length, Object.keys(catalog).length, 'catalog keys must be unique');
});

test('three languages translate dynamic labels and compound narratives', () => {
  const description = 'A soft, diffused light settles over the city. Bring a warm layer. The air has a little bite.';
  assert.equal(translate(description, 'en'), description);
  for (const language of ['kk', 'ru']) {
    assert.doesNotMatch(translate(description, language), /[a-z]/i);
    assert.doesNotMatch(translate('91 percent cloud cover', language), /percent/);
    assert.doesNotMatch(translate('72.7 km visibility', language), /visibility/);
    assert.doesNotMatch(translate('−3m 46s vs yesterday', language), /yesterday/);
    assert.doesNotMatch(translate('Sunset in', language), /Sunset/);
  }
});

test('language switching updates API locale and localized dates', () => {
  for (const language of ['kk', 'ru', 'en']) {
    setLanguage(language);
    assert.equal(apiLanguage(), language);
    const date = localizedDate(new Date('2026-10-19T12:00:00Z'), { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
    assert.match(date, language === 'kk' ? /қазан/ : language === 'ru' ? /октября/ : /October/);
  }
});
