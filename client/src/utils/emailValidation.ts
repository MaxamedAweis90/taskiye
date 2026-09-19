/**
 * Client-side email validation to detect invalid, placeholder, disposable, and mistyped emails.
 */

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

export interface ClientEmailValidation {
  isValid: boolean;
  error?: string;
}

export function validateEmail(rawEmail: string): ClientEmailValidation {
  if (!rawEmail || !rawEmail.trim()) {
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

  const [, domain] = parts;

  // Detect common mistyped domains
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
      error: 'Temporary or disposable email addresses are not allowed. Please enter your real email address.',
    };
  }

  if (INVALID_TEST_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: 'Please enter a real email address so you can receive your verification link.',
    };
  }

  const domainParts = domain.split('.');
  if (domainParts.length < 2 || domainParts.some((p) => p.length === 0)) {
    return { isValid: false, error: 'Invalid email domain format.' };
  }

  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || /^\d+$/.test(tld)) {
    return { isValid: false, error: 'Please enter an email with a valid domain extension.' };
  }

  return { isValid: true };
}
