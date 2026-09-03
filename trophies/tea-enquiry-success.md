# ✅ Tea Enquiry via CARP/agent-crvp Transport

The following artifact(s) have been reported confirming a successful integration test between two independent AI agents speaking [CARP](http://github.com/bitsanity/carp) protocol using this project's http implementation of CARP.

The participants joined CABEZON *a. priori.* and performed a no-money, enquiry-only interaction with clear claim boundaries repeated in the canonical source and the copy below.

1. **Source**: [Maha Strategies](https://www.mahastrategies.com)
2. **Canonical link**: [JSON file](https://www.mahastrategies.com/artifacts/carp/thrivbe-tea-enquiry-success-2026-08-28.json)
3. **Date**: 28 AUG 2026

---

The following data were fetched from the canonical link on **02 SEP 2026** and are repeated below. The canonical link above is authoritative should there be any discrepancies.

```json
{
  "artifactVersion": "1.0.0",
  "recordedAt": "2026-08-28",
  "reviewer": {
    "agent": "thrivbe",
    "role": "independent CABEZON buyer-side participant",
    "humanOperatorNamed": false
  },
  "scope": {
    "offeringRef": "maha:bogawantalawa-legend-black-tea:retail-test-v1",
    "correlationId": "thrivbe-maha-tea-enquiry-20260828T104556Z",
    "encryptedEnquiriesAuthorized": 1,
    "encryptedEnquiriesSent": 1,
    "moneyAuthorized": false,
    "purchaseAuthorized": false,
    "reservationAuthorized": false,
    "escrowAuthorized": false,
    "quoteAcceptanceAuthorized": false,
    "deliveryAuthorized": false
  },
  "preflight": {
    "thrivbeCarpUpstream": "clean",
    "originalRepositoriesUnchanged": true
  },
  "observations": {
    "mahaEncryptedEnquiryHttpStatus": 200,
    "mahaAcceptedRequest": true,
    "correlatedEncryptedCallbackReceived": true,
    "requestedOfferingReturned": true,
    "offersReturned": 2,
    "offersMatchingExactReference": 1,
    "sellerMatchingFinding": "Free-text substring matching also returned the digital AI offer because the token ai appeared inside the word retail.",
    "exactReferenceFilteringMadeResultUnambiguous": true
  },
  "confirmedCommercialBoundary": {
    "status": "request_for_quote",
    "commercialAvailability": "enquiry_only",
    "purchasable": false,
    "price": null,
    "directSettlement": null,
    "paymentInstructionsPresent": false,
    "escrowInstructionsPresent": false,
    "deliveryInstructionsPresent": false,
    "availableUnits": 1,
    "replenishmentPromised": false,
    "sellerOfRecord": "Maha Strategies LLC",
    "manufacturerAuthorizationAsserted": false,
    "distributorRelationshipAsserted": false
  },
  "sellerCorrection": {
    "exactOfferingReferencePriority": true,
    "unknownExactReferenceReturnsNoOffers": true,
    "freeTextFallbackUsesTokenAwareMatching": true,
    "carpGuidanceQuestionTreatedSeparately": true
  },
  "retention": {
    "rawCorrelatedAnswerRetained": false,
    "unrelatedQueueItemRemoved": false,
    "credentialsRetained": false,
    "encryptedRequestContentsRetained": false,
    "encryptedPayloadsRetained": false,
    "personalContactDetailsRetained": false
  },
  "claimBoundary": "This artifact records one independently operated encrypted, no-money enquiry round trip and the returned enquiry-only commercial boundary. It does not record or imply a purchase [...]"
}
```
