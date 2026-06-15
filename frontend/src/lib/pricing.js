// Central pricing configuration for Welkora.
// Single source of truth — change rates here and the whole landing page updates.

// Volume tiers: the per-user rate of the highest reached tier applies to ALL users.
// Anchor points: 10→€49, 25→€99, 50→€179, 100→€299 (per month).
export const PRICE_TIERS = [
  { upTo: 10, rate: 4.9 },
  { upTo: 25, rate: 3.96 },
  { upTo: 50, rate: 3.58 },
  { upTo: 100, rate: 2.99 },
  { upTo: 250, rate: 2.49 },
  { upTo: Infinity, rate: 1.99 },
];

// Minimum monthly price (covers the smallest plan).
export const MIN_USERS = 1;
export const MAX_SLIDER_USERS = 250; // above this we suggest an enterprise offer
export const DEFAULT_USERS = 25;

// Annual billing grants 2 months free (pay for 10 instead of 12).
export const ANNUAL_FREE_MONTHS = 2;

// Preset plan cards shown on the pricing section.
export const PRESET_PLANS = [10, 25, 50, 100];

function rateForUsers(users) {
  const tier = PRICE_TIERS.find((t) => users <= t.upTo) || PRICE_TIERS[PRICE_TIERS.length - 1];
  return tier.rate;
}

/**
 * Calculate pricing for a given number of users.
 * @param {number} usersInput
 * @returns {{users:number, perUser:number, monthly:number, annual:number, annualMonthly:number, isEnterprise:boolean}}
 */
export function calculatePrice(usersInput) {
  const users = Math.max(MIN_USERS, Math.floor(Number(usersInput) || MIN_USERS));
  const isEnterprise = users > MAX_SLIDER_USERS;
  const perUser = rateForUsers(users);
  const monthly = Math.round(users * perUser);
  // Annual: pay for (12 - free) months, billed yearly.
  const annual = Math.round(monthly * (12 - ANNUAL_FREE_MONTHS));
  const annualMonthly = Math.round(annual / 12);
  return { users, perUser, monthly, annual, annualMonthly, isEnterprise };
}

export function formatEuro(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
