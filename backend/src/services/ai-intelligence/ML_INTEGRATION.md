# AI Intelligence ML Integration

## ML Usage Policy

**CRITICAL RULE**: ML is augmentation only, NOT replacement of rule-based logic.

## Approved ML Use Cases

ML models are ONLY used for:

1. **Revenue Time-Series Forecasting** (`forecastTimeSeries`)
   - Location: `FinancialIntelligenceEngine`
   - Purpose: Predict next month revenue
   - Fallback: Rule-based moving average
   - Confidence threshold: 70%

2. **Payment Behavior Trend Detection** (`detectPaymentTrend`)
   - Location: `TransactionRiskEngine`
   - Purpose: Detect improving/declining payment patterns
   - Fallback: Rule-based pattern analysis
   - Confidence threshold: 70%

3. **Tenant Churn Probability** (`calculateChurnProbability`)
   - Location: `TenantIntelligenceEngine`
   - Purpose: Predict tenant churn risk
   - Fallback: Rule-based lease expiration analysis
   - Confidence threshold: 70%

4. **Construction Delay Probability** (`calculateDelayProbability`)
   - Location: `ConstructionIntelligenceEngine`
   - Purpose: Predict project delay risk
   - Fallback: Rule-based progress variance calculation
   - Confidence threshold: 70%

## ML Output Rules

Every ML output MUST:

1. **Pass through rule-based validation** - ML never bypasses validation
2. **Include confidence interval** - Where applicable (forecasts)
3. **Be explainable** - Every prediction includes explanation
4. **Fall back gracefully** - If confidence < threshold → return null prediction
5. **Never force predictions** - `status: "insufficient_data"` is valid

## ML Model Behavior

### Low Confidence Handling

If ML confidence < threshold:
```typescript
{
  prediction: null,
  confidence: <calculated>,
  status: "insufficient_data",
  explanation: "Confidence below threshold. Insufficient data quality."
}
```

### ML vs Rule-Based

- **ML is tried first** (if data quality sufficient)
- **Rule-based is fallback** (always available)
- **Both are explainable** (method included in explanation)
- **Both respect confidence thresholds** (no forced predictions)

## Forbidden ML Uses

ML must NOT be used for:

- ❌ HR performance scoring
- ❌ Individual employee judgment
- ❌ Financial posting decisions
- ❌ Tenant-facing decisions
- ❌ Any decision that cannot be explained/audited

## Implementation Pattern

```typescript
// 1. Try ML first
const mlResult = mlModel.compute(params);

// 2. Check confidence
if (mlResult.confidence >= threshold && mlResult.prediction !== null) {
  // Use ML prediction
  return mlResult;
}

// 3. Fallback to rule-based
const ruleBasedResult = ruleBasedLogic.compute(params);
return ruleBasedResult;
```

## Audit Trail

Every ML prediction includes:
- Method used (`ml` | `rule_based` | `insufficient_data`)
- Data quality score
- Confidence interval (where applicable)
- Factors considered (for probability models)
- Explanation of how prediction was derived

## Compliance

All ML outputs are:
- ✅ Explainable
- ✅ Auditable
- ✅ Finance-reviewable
- ✅ Legal-reviewable

If any insight cannot meet these criteria → it does NOT appear in UI.
