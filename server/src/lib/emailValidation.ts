import { promises as dns } from 'dns';



const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com',
  'temp-mail.org',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  '10minutemail.com',
  '10minutemail.net',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'trashmail.com',
  'trashmail.net',
  'trashmail.me',
  'dispostable.com',
  'getnada.com',
  'fakeinbox.com',
  'mohmal.com',
  'crazymailing.com',
  'mytemp.email',
  'tempail.com',
  'burnermail.io',
  'maildrop.cc',
  'harakirimail.com',
  'generator.email',
  'inboxkitten.com',
  'fakemailgenerator.com',
  'emailondeck.com',
  'tempm.com',
  'dropmail.me',
]);

const INVALID_TEST_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.org',
  'fake.com',
  'invalid.com',
  'asdf.com',
  'qwerty.com',
]);

const TYPO_DOMAIN_SUGGESTIONS: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmaild.com': 'gmail.com',
  'gemail.com': 'gmail.com',
  'gmaile.com': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.co': 'yahoo.com',
  'yahou.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'iclou.com': 'icloud.com',
  'icloud.co': 'icloud.com',
};

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateEmailAddress(rawEmail: string): EmailValidationResult {
  if (!rawEmail || typeof rawEmail !== 'string') {
    return { isValid: false, error: 'Email address is required.' };
  }

  const email = rawEmail.trim().toLowerCase();

  if (email.length > 254) {
    return { isValid: false, error: 'Email address is too long.' };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address (e.g. name@gmail.com).' };
  }

  const parts = email.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { isValid: false, error: 'Invalid email structure.' };
  }

  const localPart = parts[0];
  const domain = parts[1];

  if (localPart.length === 0 || domain.length === 0) {
    return { isValid: false, error: 'Email local part or domain is empty.' };
  }

  const suggestion = TYPO_DOMAIN_SUGGESTIONS[domain];
  if (suggestion) {
    return {
      isValid: false,
      error: `Did you mean @${suggestion}? Please check your email for typos.`,
    };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: 'Temporary or disposable email addresses are not allowed. Please use a real email address (e.g. Gmail, Outlook, Yahoo).',
    };
  }

  if (INVALID_TEST_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: 'Test or placeholder email domains are not allowed. Please use your real email address.',
    };
  }

  const domainParts = domain.split('.');
  if (domainParts.length < 2 || domainParts.some((p) => p.length === 0)) {
    return { isValid: false, error: 'Invalid email domain format.' };
  }

  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || /^\d+$/.test(tld)) {
    return { isValid: false, error: 'Invalid top-level domain.' };
  }

  return { isValid: true };
}

export async function verifyDomainHasMx(domain: string): Promise<boolean> {
  const trusted = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com']);
  if (trusted.has(domain)) return true;

  try {
    const records = await dns.resolveMx(domain);
    return Boolean(records && records.length > 0);
  } catch {
    return false;
  }
}
