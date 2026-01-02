# Google Custom Search Engine Setup Guide

## Issue: "Invalid search parameters" Error
Your Custom Search Engine is currently configured incorrectly. Here's how to fix it:

## Steps to Fix Your Search Engine:

1. **Go back to your Custom Search Engine settings:**
   - Visit: https://cse.google.com/cse/all
   - Click on your "Price_Compare" search engine

2. **Configure to Search the Entire Web:**
   - Click on "Setup" in the left sidebar
   - Under "Sites to search", you should see either:
     - Specific websites listed, OR
     - "Search the entire web" option
   
3. **Enable "Search the entire web":**
   - If you see specific sites listed, delete them all
   - Look for an option like "Search the entire web but emphasize included sites"
   - OR find "Search the entire web" checkbox and enable it

4. **Alternative Setup (if above doesn't work):**
   - Delete your current search engine
   - Create a new one with these settings:
     - Name: Price_Compare_Web
     - What to search: Select "Search the entire web"
     - SafeSearch: Moderate
     - Image search: ON
   - Copy the new Search Engine ID

## Expected Search Engine Configuration:
- **Type**: Search the entire web
- **SafeSearch**: Moderate  
- **Image Search**: Enabled
- **Language**: English

## Testing After Fix:
Once you've made these changes, the system should work properly and return actual search results from Amazon, Walmart, and Target.

## Current Status:
- ✅ API Key: Configured
- ✅ Search Engine ID: 167e741c8e4b642a8
- ❌ Search Engine Config: Needs "Search entire web" enabled

The error "Invalid search parameters" occurs because the current search engine is restricted and can't perform site-specific searches (site:amazon.com, etc.) properly.