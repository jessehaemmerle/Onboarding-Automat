// Pricing helpers for Welkora.
//
// The tier rates are served by the backend (GET /api/pricing) which is the
// single source of truth (backend/pricing.py). This module keeps a matching
// fallback so the public landing page renders instantly and still works if the
// request fails; once the live config loads, components re-render with it.

import { useEffect, useState } from "react";
import api from "./api";

// Fallback config — mirrors backend/pricing.py defaults.
export const DEFAULT_PRICING_CONFIG = {
  tiers: [
    { upTo: 10, rate: 4.9 },
    { upTo: 25, rate: 3.96 },
    { upTo: 50, rate: 3.58 },
    { upTo: 100, rate: 2.99 },
    { upTo: 250, rate: 2.49 },
    { upTo: null, rate: 1.99 }, // null = no upper bound (Infinity)
  ],
  minUsers: 1,
  maxSliderUsers: 250,
  defaultUsers: 25,
  annualFreeMonths: 2,
  presetPlans: [10, 25, 50, 100],
};

function rateForUsers(users, config) {
  const tiers = config?.tiers?.length ? config.tiers : DEFAULT_PRICING_CONFIG.tiers;
  const tier = tiers.find((t) => t.upTo == null || users <= t.upTo) || tiers[tiers.length - 1];
  return tier.rate;
}

/**
 * Calculate pricing for a given number of users.
 * @param {number} usersInput
 * @param {object} [config] pricing config (defaults to the fallback)
 */
export function calculatePrice(usersInput, config = DEFAULT_PRICING_CONFIG) {
  const cfg = config || DEFAULT_PRICING_CONFIG;
  const minUsers = cfg.minUsers ?? 1;
  const freeMonths = cfg.annualFreeMonths ?? 2;
  const maxSlider = cfg.maxSliderUsers ?? DEFAULT_PRICING_CONFIG.maxSliderUsers;

  const users = Math.max(minUsers, Math.floor(Number(usersInput) || minUsers));
  const isEnterprise = users > maxSlider;
  const perUser = rateForUsers(users, cfg);
  const monthly = Math.round(users * perUser);
  const annual = Math.round(monthly * (12 - freeMonths));
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

// ---- live config loading (module-level cache shared across components) ----
let _cache = null;
let _inflight = null;
const _subscribers = new Set();

function _load() {
  if (_cache) return Promise.resolve(_cache);
  if (!_inflight) {
    _inflight = api
      .get("/pricing")
      .then((res) => {
        _cache = { ...DEFAULT_PRICING_CONFIG, ...res.data };
        _subscribers.forEach((fn) => fn(_cache));
        return _cache;
      })
      .catch(() => DEFAULT_PRICING_CONFIG)
      .finally(() => { _inflight = null; });
  }
  return _inflight;
}

/**
 * React hook returning the live pricing config (falls back to defaults until
 * the backend responds). Use with calculatePrice(users, config).
 */
export function usePricing() {
  const [config, setConfig] = useState(_cache || DEFAULT_PRICING_CONFIG);
  useEffect(() => {
    let active = true;
    const update = (c) => active && setConfig(c);
    _subscribers.add(update);
    _load().then((c) => active && setConfig(c));
    return () => { _subscribers.delete(update); };
  }, []);
  return { config, loading: !_cache };
}
