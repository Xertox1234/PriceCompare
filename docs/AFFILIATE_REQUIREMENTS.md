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
