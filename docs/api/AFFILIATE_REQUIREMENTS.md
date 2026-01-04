# Affiliate Account Requirements by Retailer

This document outlines the affiliate program requirements for each supported retailer in PriceCompare. You'll need to apply for and be accepted into these programs to earn commissions on referred sales.

## Overview

PriceCompare supports affiliate integrations with the following retailers:

| Retailer | Program Name | Commission Rate | Application URL | Approval Time |
|----------|-------------|-----------------|-----------------|---------------|
| Amazon | Amazon Associates | 1-10% (varies by category) | [associates.amazon.com](https://affiliate-program.amazon.com/) | 24-48 hours |
| Walmart | Walmart Affiliate Program | 1-4% | [affiliates.walmart.com](https://affiliates.walmart.com/) | 1-5 business days |
| Target | Target Partners | 1-8% | [partners.target.com](https://partners.target.com/) | 5-7 business days |
| Best Buy | Best Buy Affiliate Program | 0.5-1% | [bestbuy.affiliatetechnology.com](https://www.bestbuy.com/site/clp/best-buy-affiliate-program/pcmcat198500050002.c) | 1-3 business days |
| B&H Photo | B&H Photo Affiliate | 2-8% | [bhphotovideo.com/find/affiliateProgram.jsp](https://www.bhphotovideo.com/find/affiliateProgram.jsp) | 3-5 business days |
| Newegg | Newegg Affiliate Program | 0.5-2.5% | [newegg.com/affiliate](https://www.newegg.com/affiliate/) | 1-3 business days |

---

## Detailed Requirements by Retailer

### 1. Amazon Associates

**Program:** `amazon_associates`

**Requirements:**
- Active website/blog/app with original content
- Must disclose affiliate relationship
- No use of Amazon trademarks in domain names
- Content must not violate Amazon's guidelines

**Configuration Required:**
```json
{
  "tag": "your-associate-tag-20",
  "linkCode": "as2"
}
```

**Commission Structure:**
- Amazon Games: 20%
- Luxury Beauty: 10%
- Digital Music, Physical Music, Handmade, Digital Videos: 5%
- Physical Books, Kitchen, Automotive: 4.5%
- Amazon Fire TV Devices: 4%
- Amazon Devices (Echo, Ring, etc.): 4%
- Toys, Furniture, Home Improvement: 3%
- PC, PC Components, DVD & Blu-Ray: 2.5%
- TVs, Digital Video Games: 2%
- Physical Video Games & Consoles: 1%
- Health & Personal Care: 1%
- Gift Cards, Grocery: 0%

**Cookie Duration:** 24 hours (90 days if item added to cart)

**Payment Threshold:** $10 (direct deposit) / $100 (check)

**Special Notes:**
- Must make at least one qualifying sale within 180 days of signup
- Cannot use affiliate links in emails
- Price information must be updated at least daily
- Must include Prime eligibility disclaimer

---

### 2. Walmart Affiliate Program (Impact)

**Program:** `walmart_connect`

**Requirements:**
- Website must be established with quality content
- No adult, gambling, or controversial content
- US-based traffic preferred
- Must comply with FTC disclosure requirements

**Configuration Required:**
```json
{
  "publisherId": "your-publisher-id",
  "campaignId": "optional-campaign-id"
}
```

**Commission Structure:**
- Contact Lenses: 4%
- Most other categories: 1-4%
- Electronics: 1%

**Cookie Duration:** 3 days

**Payment Threshold:** $50

**Special Notes:**
- Program managed through Impact Radius
- Walmart+ referrals may have separate commission structure
- Grocery pickup/delivery has different terms

---

### 3. Target Partners (Impact)

**Program:** `target_partners`

**Requirements:**
- Quality website with original content
- Audience alignment with Target's demographics
- No incentivized traffic (cashback sites need pre-approval)
- Must maintain brand safety standards

**Configuration Required:**
```json
{
  "campaignId": "your-target-campaign-id"
}
```

**Commission Structure:**
- Apparel & Accessories: 5-8%
- Home & Outdoor Living: 5%
- Baby Gear & Furniture: 5%
- Health & Beauty: 1%
- Electronics: 1%
- All other categories: 1-5%

**Cookie Duration:** 7 days

**Payment Threshold:** $50

**Special Notes:**
- Higher rates available for high-volume affiliates
- Target Circle (loyalty) offers may affect attribution
- Some exclusions during holiday promotional periods

---

### 4. Best Buy Affiliate Program

**Program:** `bestbuy_affiliate`

**Requirements:**
- Established website with tech/electronics focus preferred
- Quality content with genuine product reviews
- No coupon/deal-only sites without pre-approval
- US traffic required

**Configuration Required:**
```json
{
  "offerId": "your-bestbuy-offer-id"
}
```

**Commission Structure:**
- Standard rate: 0.5-1%
- Select categories may have promotional rates
- Gaming, computers typically at lower end

**Cookie Duration:** 1 day

**Payment Threshold:** $50

**Special Notes:**
- Lower commission rates than competitors
- Good for high-AOV electronics
- Open box/refurbished items may have different rates
- Price match guarantee doesn't affect commission

---

### 5. B&H Photo Affiliate Program

**Program:** `generic_utm` (custom integration)

**Requirements:**
- Photography, video, or tech-focused content
- Professional or prosumer audience
- Quality reviews and educational content preferred

**Configuration Required:**
```json
{
  "source": "pricecompare",
  "medium": "affiliate",
  "campaign": "bh-photo"
}
```

**Commission Structure:**
- Photography Equipment: 2-4%
- Pro Video: 2-4%
- Consumer Electronics: 2-8%
- Computers: 2%

**Cookie Duration:** 60 days

**Payment Threshold:** $50

**Special Notes:**
- Excellent for high-end photography gear
- Tax-free advantage for many states
- Strong in B2B/prosumer market
- EDU discounts may affect tracking

---

### 6. Newegg Affiliate Program

**Program:** `generic_utm` (custom integration)

**Requirements:**
- Tech/PC building content focus
- Gaming, DIY computer building audience
- No trademark bidding on search engines

**Configuration Required:**
```json
{
  "source": "pricecompare",
  "medium": "affiliate"
}
```

**Commission Structure:**
- Standard: 0.5-2.5%
- Higher rates during promotional periods
- PC components at lower end

**Cookie Duration:** 7 days

**Payment Threshold:** $50

**Special Notes:**
- Strong for PC builders and gaming
- Flash sales/promotions frequent
- Shell shocker deals may have exclusions

---

## Environment Variables

Configure affiliate credentials in your `.env` file:

```bash
# Amazon Associates
AMAZON_ASSOCIATE_TAG=your-tag-20

# Walmart (Impact)
WALMART_PUBLISHER_ID=your-publisher-id

# Target (Impact)
TARGET_CAMPAIGN_ID=your-campaign-id

# Best Buy
BESTBUY_OFFER_ID=your-offer-id

# Generic tracking
AFFILIATE_SOURCE=pricecompare
```

---

## Database Configuration

Affiliate settings are stored in the `retailers` table:

| Column | Description |
|--------|-------------|
| `affiliate_program` | Program identifier (e.g., `amazon_associates`) |
| `affiliate_status` | `active`, `pending`, `inactive` |
| `affiliate_config` | JSON with program-specific credentials |

Example affiliate config:
```sql
UPDATE retailers
SET affiliate_program = 'amazon_associates',
    affiliate_status = 'active',
    affiliate_config = '{"tag": "pricecompare-20"}'
WHERE name = 'Amazon';
```

---

## Compliance Requirements

### FTC Disclosure
All affiliate links must be disclosed. Add to your site:
> "As an affiliate, we may earn commission from qualifying purchases."

### Price Accuracy
- Amazon: Prices must be refreshed at least every 24 hours
- Others: Follow program-specific guidelines

### Trademark Usage
- Never use retailer logos without permission
- Don't imply official partnership
- Follow each program's brand guidelines

---

## Application Checklist

Before applying to affiliate programs:

- [ ] Website is live with substantial content
- [ ] Privacy policy is in place
- [ ] Terms of service published
- [ ] Contact information visible
- [ ] No prohibited content (adult, gambling, etc.)
- [ ] FTC disclosure statement prepared
- [ ] Traffic analytics available (Google Analytics, etc.)
- [ ] Tax information ready (W-9 for US)

---

## Pre-Launch Affiliate Validation

Before launching with affiliate links in production, validate your affiliate setup to ensure proper tracking and commission attribution.

### 1. Verify Affiliate Account Status

Check that all retailer accounts are approved and active:

```sql
SELECT
  name,
  affiliate_program,
  affiliate_status,
  affiliate_config
FROM retailers
WHERE affiliate_status = 'active'
ORDER BY name;
```

**Expected results:**
- Amazon: `affiliate_program = 'amazon_associates'`, `affiliate_status = 'active'`
- Walmart: `affiliate_program = 'walmart_connect'`, `affiliate_status = 'active'`
- Target: `affiliate_program = 'target_partners'`, `affiliate_status = 'active'`
- Best Buy: `affiliate_program = 'bestbuy_affiliate'`, `affiliate_status = 'active'`
- B&H Photo: `affiliate_program = 'generic_utm'`, `affiliate_status = 'active'`
- Newegg: `affiliate_program = 'generic_utm'`, `affiliate_status = 'active'`

### 2. Test Affiliate Link Generation

Validate that links are generating correctly with proper tracking parameters:

**Test Amazon Links:**
```bash
curl -X GET "https://your-domain.com/api/products/1/offers" | jq '.offers[] | select(.retailer == "Amazon") | .affiliateUrl'
```

Expected format: `https://www.amazon.com/dp/PRODUCTID?tag=your-tag-20&linkCode=as2`

**Test Walmart Links:**
```bash
curl -X GET "https://your-domain.com/api/products/1/offers" | jq '.offers[] | select(.retailer == "Walmart") | .affiliateUrl'
```

Expected format: URL contains `publisherId=YOUR_PUBLISHER_ID`

**Test Target Links:**
Expected format: URL contains `campaignId=YOUR_CAMPAIGN_ID`

**Test Best Buy Links:**
Expected format: URL contains `offerId=YOUR_OFFER_ID`

**Test B&H Photo Links:**
Expected format: URL contains `utm_source=pricecompare&utm_medium=affiliate`

**Test Newegg Links:**
Expected format: URL contains `utm_source=pricecompare&utm_medium=affiliate`

### 3. Run Affiliate Link Health Check

Use the health check endpoint to verify all affiliate links are accessible:

```bash
curl -X POST "https://your-domain.com/api/affiliate/health-check" \
  -H "Content-Type: application/json"
```

**Expected response:**
```json
{
  "status": "healthy",
  "retailers": [
    { "name": "Amazon", "status": "ok", "responseTime": "120ms" },
    { "name": "Walmart", "status": "ok", "responseTime": "95ms" },
    { "name": "Target", "status": "ok", "responseTime": "110ms" },
    { "name": "Best Buy", "status": "ok", "responseTime": "105ms" },
    { "name": "B&H Photo", "status": "ok", "responseTime": "130ms" },
    { "name": "Newegg", "status": "ok", "responseTime": "98ms" }
  ]
}
```

If any retailer returns `"status": "error"`, investigate:
- Check affiliate credentials in database
- Verify retailer site is accessible
- Check for IP blocking or rate limiting

### 4. Verify Retailer Dashboard Access

Before launch, ensure you can access all affiliate dashboards:

- [ ] Amazon Associates: Login to [affiliate-program.amazon.com](https://affiliate-program.amazon.com)
- [ ] Walmart (Impact): Login to Impact Radius dashboard
- [ ] Target (Impact): Login to Impact Radius dashboard
- [ ] Best Buy: Login to affiliate network portal
- [ ] B&H Photo: Verify tracking via email reports or dashboard
- [ ] Newegg: Login to affiliate dashboard

### 5. Test Click Tracking

Perform manual click-through test for each retailer:

1. Generate test affiliate link from your application
2. Click the link in an incognito browser window
3. Complete simulated purchase (add to cart, don't actually purchase)
4. Wait 24-48 hours
5. Check affiliate dashboard for tracked click

**Note:** Some retailers take 24-72 hours to report clicks in their dashboards.

### 6. Validate Environment Variables

Ensure all affiliate environment variables are set in production:

```bash
# Amazon
echo $AMAZON_ASSOCIATE_TAG  # Should output: your-tag-20

# Walmart
echo $WALMART_PUBLISHER_ID  # Should output: your-publisher-id

# Target
echo $TARGET_CAMPAIGN_ID    # Should output: your-campaign-id

# Best Buy
echo $BESTBUY_OFFER_ID      # Should output: your-offer-id

# Generic tracking
echo $AFFILIATE_SOURCE      # Should output: pricecompare
```

### Cross-Reference

For complete production launch preparation (beyond affiliate setup), see [Launch Preparation Guide](../guides/LAUNCH_PREPARATION_GUIDE.md).

---

## Monitoring & Optimization

Use these endpoints to monitor affiliate performance:

```
GET /api/affiliate/stats              # Overall statistics
GET /api/affiliate/stats/:retailerId  # Per-retailer stats
POST /api/affiliate/health-check      # Validate link health
```

Track key metrics:
- Click-through rate (CTR)
- Conversion rate
- Earnings per click (EPC)
- Link health status

---

## Post-Launch Affiliate Monitoring

Monitor affiliate performance during the critical first week to ensure proper tracking and optimize for conversions.

### First 24 Hours - Critical Checks

**Immediate Verification (Hour 1-4):**
- [ ] Affiliate links generating correctly in production
- [ ] Health check endpoint returning 200 for all retailers
- [ ] Click tracking operational (monitor application logs)
- [ ] No affiliate-related errors in error monitoring (Sentry)

**Day 1 Checks:**
- [ ] Monitor `GET /api/affiliate/stats` for click counts
- [ ] Verify clicks appear in application analytics
- [ ] Check for any broken affiliate links (404s)
- [ ] Review retailer dashboard for click registration (may take 24-48 hours)

### First Week - Performance Validation

**Days 2-3: Click Tracking Validation**
- [ ] Verify clicks appearing in retailer dashboards
  - Amazon: Should see clicks within 24 hours
  - Walmart/Target (Impact): Within 24-48 hours
  - Best Buy: Within 24 hours
  - B&H Photo: Check email reports or dashboard
  - Newegg: Within 24-48 hours
- [ ] Monitor click-through rate (CTR)
  - Target: 5-10% CTR from product pages
  - Below 2%: Review link placement and user experience
- [ ] Check for affiliate link errors in application logs

**Days 4-7: Conversion Tracking**
- [ ] Monitor for first conversions (timing depends on cookie duration)
  - Amazon: 24-hour cookie (90 days if added to cart)
  - Walmart: 3-day cookie
  - Target: 7-day cookie
  - Best Buy: 1-day cookie
  - B&H Photo: 60-day cookie
  - Newegg: 7-day cookie
- [ ] Validate commission amounts match expected rates
- [ ] Identify top-performing retailers and products
- [ ] Review any declined commissions (reasons vary by retailer)

**Week 1 Metrics Review:**

Use affiliate stats API:
```bash
curl -X GET "https://your-domain.com/api/affiliate/stats"
```

Track key metrics:
- **Click-through Rate (CTR):** Clicks ÷ Product Page Views × 100
- **Conversion Rate:** Conversions ÷ Clicks × 100
- **Earnings Per Click (EPC):** Total Earnings ÷ Total Clicks
- **Average Order Value (AOV):** Total Sales ÷ Conversions

**Benchmark targets:**
- CTR: 5-10% (good), 10%+ (excellent)
- Conversion Rate: 2-5% (typical for cold traffic)
- EPC: Varies widely by retailer and category

### Troubleshooting Launch Issues

**Issue: Clicks not appearing in retailer dashboards**
- **Wait Period:** Some retailers take 24-72 hours to report clicks
- **Check:** Verify affiliate config in database matches retailer requirements
- **Check:** Ensure affiliate IDs are correct in environment variables
- **Check:** Test click manually in incognito browser
- **Contact:** Retailer affiliate support if clicks not appearing after 72 hours

**Issue: Links generating without tracking parameters**
- **Check:** Affiliate service initialization in application startup logs
- **Check:** Database `affiliate_config` JSON format is correct
- **Fix:** Restart application to reinitialize affiliate services

**Issue: Low conversion rates**
- **Review:** Cookie duration vs. typical purchase timeline
- **Review:** Product price competitiveness
- **Review:** Link placement and call-to-action clarity
- **Optimize:** Test different link placements and messaging

**Issue: Commissions declined**
- **Amazon:** Verify customer didn't use coupon codes from other affiliates
- **Walmart/Target:** Check for prohibited traffic sources
- **General:** Review retailer program terms for compliance issues
- **Contact:** Retailer support for specific decline reasons

**Issue: Affiliate account suspended**
- **Common causes:** FTC disclosure missing, prohibited content, click fraud
- **Review:** Ensure compliance with all program requirements
- **Contact:** Retailer affiliate support immediately
- **Document:** Keep records of traffic sources and compliance measures

### Optimization Opportunities (After First Week)

Once baseline performance is established:
- Identify highest-converting products and retailers
- Optimize link placement based on heat mapping and analytics
- Test different call-to-action messaging
- Review low-performing retailers (consider removing if consistently <1% conversion)
- Analyze user journey from product view to affiliate click
- A/B test affiliate link presentation styles

---

## Troubleshooting

**Common Issues:**

1. **Links not tracking**: Verify affiliate config in database
2. **Low conversion**: Check cookie duration vs. purchase timeline
3. **Rejected application**: Improve site content, reapply after 30 days
4. **Payment delays**: Verify tax information is complete

**Support Contacts:**
- Amazon Associates: [affiliate-program.amazon.com/help](https://affiliate-program.amazon.com/help)
- Impact (Walmart/Target): Support through Impact dashboard
- Best Buy: Via affiliate network portal
