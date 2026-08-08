// Fraud Rules Engine — custom merchant-configured fraud prevention rules
// Rules are stored in Shop.config JSON (under key `fraudRules`) and evaluated
// alongside built-in checks in the check_fraud MCP tool.

export interface FraudRulesConfig {
  /** Max number of returns a single customer can make within the window (default 3) */
  maxReturnsPerCustomer: number;
  /** Lookback window in days for maxReturnsPerCustomer (default 30) */
  maxReturnsWindowDays: number;
  /** Max dollar value per single return request (default 5000) */
  maxValuePerReturn: number;
  /** Array of ISO 3166-1 alpha-2 country codes to block returns from */
  blockedCountries: string[];
  /** Array of email domains (e.g. "tempmail.com") considered suspicious */
  suspiciousEmailDomains: string[];
  /** Whether to enable all custom rules (default true) */
  enabled: boolean;
}

export interface FraudRuleResult {
  triggered: boolean;
  rule: string;
  details: string;
  score: number;
}

export interface FraudEvaluationResult {
  passed: boolean;
  triggeredRules: FraudRuleResult[];
  maxScore: number;
}

// Sensible defaults
export const DEFAULT_FRAUD_RULES: FraudRulesConfig = {
  maxReturnsPerCustomer: 3,
  maxReturnsWindowDays: 30,
  maxValuePerReturn: 5000,
  blockedCountries: [],
  suspiciousEmailDomains: [
    "mailinator.com",
    "guerrillamail.com",
    "10minutemail.com",
    "tempmail.com",
    "throwaway.email",
    "sharklasers.com",
    "yopmail.com",
    "trashmail.com",
  ],
  enabled: true,
};

const COMMON_COUNTRY_NAMES: Record<string, string> = {
  "US": "US", "USA": "US", "UNITED STATES": "US", "AMERICA": "US",
  "GB": "GB", "UK": "GB", "UNITED KINGDOM": "GB",
  "CA": "CA", "CANADA": "CA",
  "AU": "AU", "AUSTRALIA": "AU",
  "DE": "DE", "GERMANY": "DE",
  "FR": "FR", "FRANCE": "FR",
  "NL": "NL", "NETHERLANDS": "NL",
  "RU": "RU", "RUSSIA": "RU", "RUSSIAN FEDERATION": "RU",
  "CN": "CN", "CHINA": "CN",
  "IN": "IN", "INDIA": "IN",
};

function normalizeCountry(country: string): string {
  const upper = country.trim().toUpperCase();
  return COMMON_COUNTRY_NAMES[upper] || upper;
}

function extractEmailDomain(email: string): string | null {
  const atIndex = email.indexOf("@");
  if (atIndex === -1) return null;
  return email.slice(atIndex + 1).toLowerCase().trim();
}

/**
 * Load fraud rules from a shop's config JSON, falling back to defaults.
 */
export function loadFraudRules(shopConfig: Record<string, any>): FraudRulesConfig {
  const raw = shopConfig?.fraudRules;
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_FRAUD_RULES };
  }
  return {
    maxReturnsPerCustomer:
      typeof raw.maxReturnsPerCustomer === "number" && raw.maxReturnsPerCustomer > 0
        ? raw.maxReturnsPerCustomer
        : DEFAULT_FRAUD_RULES.maxReturnsPerCustomer,
    maxReturnsWindowDays:
      typeof raw.maxReturnsWindowDays === "number" && raw.maxReturnsWindowDays > 0
        ? raw.maxReturnsWindowDays
        : DEFAULT_FRAUD_RULES.maxReturnsWindowDays,
    maxValuePerReturn:
      typeof raw.maxValuePerReturn === "number" && raw.maxValuePerReturn > 0
        ? raw.maxValuePerReturn
        : DEFAULT_FRAUD_RULES.maxValuePerReturn,
    blockedCountries: Array.isArray(raw.blockedCountries)
      ? raw.blockedCountries
      : DEFAULT_FRAUD_RULES.blockedCountries,
    suspiciousEmailDomains: Array.isArray(raw.suspiciousEmailDomains)
      ? raw.suspiciousEmailDomains
      : DEFAULT_FRAUD_RULES.suspiciousEmailDomains,
    enabled: raw.enabled !== false,
  };
}

/**
 * Validate a potential FraudRulesConfig object (for UI save validation).
 * Returns an array of error messages (empty = valid).
 */
export function validateFraudRules(raw: any): string[] {
  const errors: string[] = [];
  if (raw.maxReturnsPerCustomer !== undefined && (typeof raw.maxReturnsPerCustomer !== "number" || raw.maxReturnsPerCustomer < 1)) {
    errors.push("Max returns per customer must be a positive number");
  }
  if (raw.maxReturnsWindowDays !== undefined && (typeof raw.maxReturnsWindowDays !== "number" || raw.maxReturnsWindowDays < 1)) {
    errors.push("Returns window must be a positive number of days");
  }
  if (raw.maxValuePerReturn !== undefined && (typeof raw.maxValuePerReturn !== "number" || raw.maxValuePerReturn < 0)) {
    errors.push("Max value per return must be a non-negative number");
  }
  if (raw.blockedCountries !== undefined && !Array.isArray(raw.blockedCountries)) {
    errors.push("Blocked countries must be a list");
  }
  if (raw.suspiciousEmailDomains !== undefined && !Array.isArray(raw.suspiciousEmailDomains)) {
    errors.push("Suspicious email domains must be a list");
  }
  return errors;
}

/**
 * Evaluate custom fraud rules against a return request.
 *
 * @param params - the return request details and context
 * @param rules  - the merchant's configured fraud rules
 * @param recentReturnCount - number of returns by this customer in the window (pass null to skip)
 * @returns a FraudEvaluationResult
 */
export function evaluateFraudRules(
  params: {
    totalAmount: number;
    customerEmail?: string | null;
    customerCountry?: string | null;
  },
  rules: FraudRulesConfig,
  recentReturnCount: number | null
): FraudEvaluationResult {
  if (!rules.enabled) {
    return { passed: true, triggeredRules: [], maxScore: 0 };
  }

  const triggered: FraudRuleResult[] = [];

  // 1. Max value per return
  if (params.totalAmount > rules.maxValuePerReturn) {
    triggered.push({
      triggered: true,
      rule: "max_value_per_return",
      details: `Return value $${params.totalAmount.toFixed(2)} exceeds max $${rules.maxValuePerReturn.toFixed(2)}`,
      score: 0.6,
    });
  }

  // 2. Max returns per customer (if count provided)
  if (recentReturnCount !== null && recentReturnCount >= rules.maxReturnsPerCustomer) {
    triggered.push({
      triggered: true,
      rule: "max_returns_per_customer",
      details: `Customer has ${recentReturnCount} returns in last ${rules.maxReturnsWindowDays} days (max ${rules.maxReturnsPerCustomer})`,
      score: 0.7,
    });
  }

  // 3. Suspicious email domains
  if (params.customerEmail && rules.suspiciousEmailDomains.length > 0) {
    const domain = extractEmailDomain(params.customerEmail);
    if (domain && rules.suspiciousEmailDomains.includes(domain)) {
      triggered.push({
        triggered: true,
        rule: "suspicious_email_domain",
        details: `Email domain "${domain}" is flagged as suspicious`,
        score: 0.8,
      });
    }
  }

  // 4. Blocked countries
  if (params.customerCountry && rules.blockedCountries.length > 0) {
    const normalized = normalizeCountry(params.customerCountry);
    if (rules.blockedCountries.includes(normalized)) {
      triggered.push({
        triggered: true,
        rule: "blocked_country",
        details: `Country "${params.customerCountry}" is blocked`,
        score: 1.0,
      });
    }
  }

  const maxScore = triggered.length > 0 ? Math.max(...triggered.map((t) => t.score)) : 0;

  return {
    passed: triggered.length === 0,
    triggeredRules: triggered,
    maxScore,
  };
}