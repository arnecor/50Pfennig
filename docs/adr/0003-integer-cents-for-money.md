# ADR-0003: Represent Money as Integer Cents

- **Date:** 2026-02-25
- **Status:** Accepted

## Context

Financial calculations using IEEE 754 floating-point numbers (JavaScript's default `number` type) produce well-known rounding errors. For example:

```
0.1 + 0.2 === 0.30000000000000004  // true in JS
```

In an expense splitting app, rounding errors compound across many calculations and can result in splits that do not sum exactly to the total — which would corrupt balance calculations.

Options considered:
- **`number` (float)** — simple, buggy for financial math
- **Integer cents (`number`, always integer)** — simple, correct for single-currency
- **`decimal.js` / `big.js`** — arbitrary precision, adds a dependency, more complex
- **`Dinero.js`** — purpose-built money library, good API, adds a dependency

## Decision

Represent all monetary values as **integer cents** (e.g. €12.50 = `1250`). Use a branded TypeScript type `Money = Brand<number, "Money">` to prevent accidentally mixing raw numbers with monetary values at compile time.

A dedicated `allocate(total, ratios)` function implements the **largest remainder method** to distribute a total across N parts such that the results always sum exactly to the original amount — no rounding drift, no external dependency.

Percentages are stored as **basis points** (1 basis point = 0.01%). A 33.33% split is stored as `3333` basis points. Validation is `sum === 10000` — an exact integer comparison, not a float comparison.

## Consequences

- **Positive:** No external dependency. No floating-point rounding errors. The constraint `splits.sum === total` can be validated with `===`.
- **Positive:** Integer cents store cleanly in Postgres as `integer` columns. No `numeric(12,2)` precision handling needed.
- **Positive:** The branded `Money` type catches accidental misuse at compile time (e.g. passing a raw price in euros where cents are expected).
- **Negative:** All monetary input from the user (e.g. "12.50") must be converted to cents on input, and back to a display value on output. The `formatMoney()` utility handles this consistently.
- **Future:** If multi-currency support is added, this decision needs revisiting. Integer cents work for a single currency but cannot represent currencies without cent subdivisions (e.g. Japanese Yen) or currencies with 3 decimal places (e.g. Kuwaiti Dinar) using the same `×100` assumption. This is an explicit V1 constraint.
