import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../src/lib/csv.js';
import { convertToInrMinor, formatMoney, gstFor } from '../src/lib/money.js';
import { financialYear, nightsBetween } from '../src/lib/time.js';
import { countWords, validateForSubmit, type AbstractDraftInput } from '../src/modules/abstracts/abstract.schemas.js';
import { sniffFileType } from '../src/modules/abstracts/abstract.service.js';
import { loadCatalogueFile, parseCatalogue, periodAt, setCatalogue } from '../src/modules/catalogue/catalogue.js';
import { amountInWords } from '../src/modules/invoices/invoice.renderer.js';

describe('money', () => {
  it('computes 18% GST in paise with integer maths', () => {
    expect(gstFor(1850000, 1800)).toBe(333000); // ₹18,500 -> ₹3,330
    expect(gstFor(100, 1800)).toBe(18); // ₹1 -> ₹0.18
    expect(gstFor(1, 1800)).toBe(0); // 0.18 paise rounds to 0
    expect(gstFor(3, 1800)).toBe(1); // 0.54 paise rounds half-up to 1
  });

  it('converts USD cents to whole INR rupees', () => {
    expect(convertToInrMinor(35000, '84')).toBe(2940000); // USD 350 @ 84 = ₹29,400
    expect(convertToInrMinor(35000, '83.456')).toBe(2921000); // 29,209.60 -> rounded to ₹29,210
  });

  it('formats INR with Indian digit grouping', () => {
    expect(formatMoney(2183000, 'INR')).toBe('₹21,830.00');
    expect(formatMoney(1234567890, 'INR')).toBe('₹1,23,45,678.90');
    expect(formatMoney(35000, 'USD')).toBe('USD 350.00');
  });

  it('writes invoice amounts in words (Indian system)', () => {
    expect(amountInWords(2183000)).toBe('Rupees Twenty One Thousand Eight Hundred Thirty Only');
    expect(amountInWords(11800018)).toBe('Rupees One Lakh Eighteen Thousand and Eighteen Paise Only');
  });
});

describe('pricing periods (IST boundaries)', () => {
  setCatalogue(loadCatalogueFile()); // the real shared/catalogue.json
  const code = (iso: string) => periodAt(new Date(iso)).code;

  it('early bird until 15 Jan 23:59:59 IST', () => {
    expect(code('2026-09-23T12:00:00+05:30')).toBe('early_bird');
    expect(code('2027-01-15T23:59:59+05:30')).toBe('early_bird');
  });
  it('regular from 16 Jan to 10 Apr IST', () => {
    expect(code('2027-01-16T00:00:00+05:30')).toBe('regular');
    expect(code('2027-04-10T23:59:59+05:30')).toBe('regular');
  });
  it('on-spot after 10 Apr IST', () => {
    expect(code('2027-04-11T00:00:00+05:30')).toBe('on_spot');
    expect(code('2027-04-24T10:00:00+05:30')).toBe('on_spot');
  });
});

describe('csv', () => {
  it('escapes commas, quotes, newlines and blocks formula injection', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell(null)).toBe('');
    const csv = toCsv(['Name', 'Amount'], [['Dr. Sen, A', '₹1,180.00']]);
    expect(csv.startsWith('﻿Name,Amount\r\n')).toBe(true);
    expect(csv).toContain('"Dr. Sen, A","₹1,180.00"');
  });
});

describe('dates', () => {
  it('counts nights and financial years', () => {
    expect(nightsBetween('2027-04-21', '2027-04-25')).toBe(4);
    expect(financialYear(new Date('2027-03-31T12:00:00+05:30'))).toBe('2026-27');
    expect(financialYear(new Date('2027-04-01T00:30:00+05:30'))).toBe('2027-28');
  });
});

describe('abstract rules', () => {
  const base: AbstractDraftInput = {
    category: 'oral',
    title: 'Outcomes of endoscopic ultrasound guided drainage',
    institution: 'IPGMER',
    department: 'Gastroenterology',
    correspondingAuthor: 'Dr. A Sen',
    track: 'Hepatology',
    keywords: ['drainage', 'EUS', 'pancreas'],
    body: 'word '.repeat(120),
    referencesText: null,
    conflictOfInterest: 'None',
    presentingAuthorAge: null,
    sgeiMembershipNo: null,
    videoUrl: null,
    videoObjectives: null,
    techniqueJustification: null,
    englishNarrationConfirmed: false,
    declarationAccepted: true,
    submittingAuthor: { firstName: 'A', middleName: null, lastName: 'Sen', email: 'a@x.in', institution: null },
    presentingAuthor: { firstName: 'A', middleName: null, lastName: 'Sen', email: null, institution: null },
    coAuthors: [],
    keepFileIds: [],
  };

  it('accepts a complete oral abstract', () => {
    expect(validateForSubmit(base, 1)).toEqual({});
  });
  it('enforces the 300 word limit', () => {
    expect(countWords('a  b\nc')).toBe(3);
    expect(validateForSubmit({ ...base, body: 'w '.repeat(301) }, 1).body).toMatch(/300 words/);
  });
  it('abstract body is optional, but limited to 300 words when given', () => {
    expect(validateForSubmit({ ...base, body: '' }, 1).body).toBeUndefined();
    expect(validateForSubmit({ ...base, body: 'w '.repeat(301) }, 1).body).toMatch(/300 words/);
  });
  it('requires department, corresponding author and a listed track / theme', () => {
    const e = validateForSubmit({ ...base, department: '', correspondingAuthor: '', track: '' }, 1);
    expect(Object.keys(e)).toEqual(['department', 'correspondingAuthor', 'track']);
  });
  it('allows 0–5 files of any type, and enforces the SGEI no / age rules', () => {
    expect(validateForSubmit(base, 0).files).toBeUndefined();
    expect(validateForSubmit(base, 6).files).toMatch(/at most 5/);
    const e = validateForSubmit({ ...base, category: 'plenary' }, 1);
    expect(e.files).toBeUndefined();
    expect(e.sgeiMembershipNo).toBeDefined();
    const y = validateForSubmit({ ...base, category: 'yia', presentingAuthorAge: 45 }, 2);
    expect(y.presentingAuthorAge).toMatch(/under 45/);
  });
  it('rejects ALL CAPS titles and wrong keyword counts', () => {
    const e = validateForSubmit({ ...base, title: 'ALL CAPS TITLE HERE', keywords: ['a'] }, 1);
    expect(e.title).toBeDefined();
    expect(e.keywords).toBeDefined();
  });
  it('sniffs real file types from magic bytes', () => {
    expect(sniffFileType(Buffer.from('%PDF-1.7 ...'))).toBe('pdf');
    expect(sniffFileType(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('....word/document.xml')]))).toBe('docx');
    expect(sniffFileType(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]))).toBe('doc');
    expect(sniffFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe('jpg');
    expect(sniffFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(sniffFileType(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom')]))).toBe('mp4');
    expect(sniffFileType(Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from('ftypqt  ')]))).toBe('mov');
    expect(sniffFileType(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]))).toBe('webm');
    expect(sniffFileType(Buffer.from('MZ executable'))).toBeNull();
  });
});

describe('static catalogue (shared/catalogue.json)', () => {
  const file = loadCatalogueFile();

  it('holds the brief\'s categories and accommodation with prices in paise (workshops: coming soon)', () => {
    expect(file.gstRateBps).toBe(1800);
    expect(file.categories.map((c) => c.code)).toEqual([
      'sgei-member', 'non-member', 'pg-student', 'accompanying-national', 'international-delegate', 'accompanying-international',
    ]);
    expect(file.categories.find((c) => c.code === 'sgei-member')!.pricesMinor).toEqual({ early_bird: 1850000, regular: 2150000, on_spot: 2450000 });
    // Workshops are "Coming soon" (client, Oct 2026): none are on sale until the list is published.
    expect(file.workshops).toEqual([]);
    expect(file.accommodation.map((a) => [a.code, a.nightlyAmountMinor / 100])).toEqual([
      ['venue-single', 14000], ['venue-twin', 8000], ['alternate-single', 10000], ['alternate-twin', 6500],
    ]);
  });

  it('rejects a broken catalogue with a readable message', () => {
    const bad = {
      gstRatePercent: 18,
      usdToInrRate: 84,
      pricingPeriods: [{ code: 'early_bird', label: 'Early', displayRange: 'x', startsAt: null, endsAt: null }],
      conferenceCategories: [
        { code: 'dup', name: 'A', kind: 'delegate', region: 'national', currency: 'INR', prices: {} },
        { code: 'dup', name: 'B', kind: 'delegate', region: 'national', currency: 'INR', prices: { early_bird: 1 } },
      ],
      workshops: [],
      accommodation: { stayWindow: { earliestCheckIn: '2027-04-20', latestCheckOut: '2027-04-26' }, options: [] },
    };
    expect(() => parseCatalogue(bad)).toThrow(/duplicate code "dup"[\s\S]*missing price for period "early_bird"[\s\S]*accompanying category/);
  });
});
