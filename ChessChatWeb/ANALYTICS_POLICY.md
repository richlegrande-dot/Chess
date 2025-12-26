# ChessChat Analytics & Privacy Policy

**Effective Date**: December 10, 2025  
**Version**: 1.0  
**Last Updated**: December 10, 2025

---

## Our Commitment to Privacy

ChessChat is committed to protecting your privacy. We believe that privacy is a fundamental right, and we've designed our analytics system with privacy as the top priority.

**Core Principle**: We collect the minimum data necessary to improve the service, and we never collect personal information.

---

## What We Collect

ChessChat uses **privacy-safe analytics** that track only aggregate usage patterns. We collect:

### Anonymous Usage Counters

1. **Total Page Loads** - How many times users visit the site
2. **Total Games Started** - How many chess games begin
3. **Total Games Finished** - How many games reach completion
4. **Total Analysis Requests** - How many post-game chats are initiated

**Important**: These are simple counters that increment with each event. They contain **zero personal information**.

---

## What We DO NOT Collect

We explicitly **DO NOT** collect:

- ❌ **No Personal Information**: No names, emails, phone numbers, addresses
- ❌ **No IP Addresses**: Your location and identity remain private
- ❌ **No User Identifiers**: No cookies, no tracking IDs, no fingerprinting
- ❌ **No Game Content**: We don't store your moves, chat messages, or game history
- ❌ **No Behavioral Tracking**: No cross-site tracking, no third-party analytics
- ❌ **No Selling Data**: We will never sell your data to anyone
- ❌ **No Advertising**: ChessChat has no ads and no ad-tracking

---

## How Analytics Work

### Technical Implementation

ChessChat uses **Cloudflare KV** (Key-Value storage) to store simple counters:

```
counter:totalPageLoads = 1234
counter:totalGamesStarted = 567
counter:totalGamesFinished = 489
counter:totalAnalysisRequests = 203
```

That's it. Just numbers. No names, no IPs, no personal data.

### When Data is Collected

Analytics counters increment when:

1. **Page Load**: When you visit chesschat-web.pages.dev
2. **Game Start**: When you begin a chess game
3. **Game Finish**: When a game ends (checkmate, stalemate, resignation)
4. **Analysis Request**: When you start a post-game chat with AI

### Where Data is Stored

- **Location**: Cloudflare's global network (distributed data centers)
- **Encryption**: All data encrypted at rest and in transit
- **Access**: Only ChessChat administrators can view aggregate statistics
- **Retention**: Counters persist indefinitely (but contain no personal info)

---

## How We Use Analytics

Analytics help us:

1. **Understand Usage Patterns**: How many people use ChessChat?
2. **Measure Engagement**: Do users complete games or abandon early?
3. **Evaluate Features**: Is post-game chat analysis popular?
4. **Plan Infrastructure**: Do we need to scale Cloudflare resources?

We **do not** use analytics for:

- ❌ Targeted advertising (we have no ads)
- ❌ Selling to third parties (we never sell data)
- ❌ Identifying individual users
- ❌ Tracking across websites

---

## Your Control

### Opt-Out

You have complete control over analytics participation:

1. **Settings Page**: Toggle "Allow anonymous usage stats" off
2. **localStorage**: Preference saved locally in your browser
3. **Effect**: When disabled, no analytics counters increment for your usage

**Default**: Analytics are **enabled** by default, but you can opt-out anytime.

### How to Opt-Out

1. Click **Settings** (⚙️) from the home screen
2. Find "📊 Anonymous Usage Stats" toggle
3. Turn it **OFF**
4. Your preference is saved locally and respected immediately

### Verification

To verify analytics are disabled:

1. Open browser developer tools (F12)
2. Go to Application → Local Storage
3. Check for `analytics-enabled = "false"`

---

## Data Security

### Cloudflare KV Security

- **Encryption**: AES-256 encryption at rest
- **TLS**: All data in transit uses TLS 1.3
- **Access Control**: Only ChessChat Functions can write counters
- **No Public Access**: Counters cannot be modified by users
- **DDoS Protection**: Cloudflare's enterprise-grade protection

### API Security

- **Rate Limiting**: Prevents abuse (30 requests/minute per IP)
- **Input Sanitization**: All inputs validated before processing
- **HTTPS-Only**: No unencrypted connections allowed
- **CSP Headers**: Content Security Policy prevents XSS attacks

---

## Third-Party Services

### OpenAI API

ChessChat uses OpenAI's API for:
- AI chess move generation
- Post-game chat analysis

**OpenAI Privacy**:
- We send: Chess position (FEN), game history (PGN), your chat messages
- OpenAI processes: Generates chess moves and analysis responses
- OpenAI retention: 30 days (per OpenAI API policy, then deleted)
- OpenAI use: Not used to train models (per OpenAI Enterprise terms)

**Reference**: [OpenAI Privacy Policy](https://openai.com/privacy)

### Cloudflare Pages

ChessChat is hosted on Cloudflare Pages:

**Cloudflare Privacy**:
- Standard web server logs (IP, User-Agent, timestamp)
- Retention: 7 days (for DDoS protection and abuse prevention)
- Use: Infrastructure security and performance optimization
- **Not shared** with ChessChat developers (we don't see Cloudflare logs)

**Reference**: [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/)

---

## Children's Privacy

ChessChat is safe for all ages, including children under 13.

**COPPA Compliance** (Children's Online Privacy Protection Act):
- ✅ We collect **no personal information** from anyone, including children
- ✅ No registration or account creation required
- ✅ No email, name, or contact information collected
- ✅ Anonymous analytics only (aggregate counters)
- ✅ No targeted advertising (we have no ads)

**Parental Guidance**:
- Children can use ChessChat without providing any personal information
- Post-game chat uses AI (OpenAI) which is monitored for safety
- Parents can disable analytics via Settings toggle

---

## International Users

ChessChat is available worldwide and complies with international privacy laws:

### GDPR (European Union)

**General Data Protection Regulation** compliance:
- ✅ **Data Minimization**: We collect only anonymous counters
- ✅ **Right to Access**: No personal data to access
- ✅ **Right to Erasure**: No personal data to erase
- ✅ **Right to Opt-Out**: Settings toggle available
- ✅ **Data Protection Officer**: Not required (no personal data)
- ✅ **Lawful Basis**: Legitimate interest (aggregate analytics)

### CCPA (California)

**California Consumer Privacy Act** compliance:
- ✅ **No Sale of Data**: We never sell any data
- ✅ **Right to Know**: Analytics endpoint shows aggregate data
- ✅ **Right to Delete**: No personal data to delete
- ✅ **Right to Opt-Out**: Settings toggle available

### Other Jurisdictions

- ✅ **Canada (PIPEDA)**: Compliant (no personal information)
- ✅ **Australia (Privacy Act)**: Compliant (no personal information)
- ✅ **Brazil (LGPD)**: Compliant (no personal information)
- ✅ **Japan (APPI)**: Compliant (no personal information)

---

## Cookies

**ChessChat does NOT use cookies.**

We use **localStorage** (browser storage) for:
1. **Model Selection**: Remember your preferred AI model (GPT-4o Mini, etc.)
2. **Sound Preference**: Remember if sound effects are enabled/disabled
3. **Drag & Drop Preference**: Remember if drag-and-drop is enabled
4. **Animation Preference**: Remember if animations should be reduced
5. **Analytics Preference**: Remember if analytics are enabled/disabled

**localStorage is local-only**:
- Stored in your browser only
- Not transmitted to servers
- Not accessible by other websites
- You can clear anytime (browser settings → Clear browsing data)

---

## Analytics Dashboard (Future)

We plan to add a public analytics dashboard at `/analytics`:

**What Will Be Shown**:
- Total page loads (all-time)
- Total games started (all-time)
- Total games finished (all-time)
- Total analysis requests (all-time)

**What Will NOT Be Shown**:
- Individual user data (we don't have it)
- IP addresses (we don't collect them)
- Geographic data (we don't track it)
- Timestamps per user (we don't store them)

**Purpose**: Transparency and accountability—show exactly what we collect.

---

## Changes to This Policy

We may update this policy as ChessChat evolves. Changes will be:

1. **Posted Here**: Always available at /privacy or /analytics-policy
2. **Dated**: "Last Updated" field shows revision date
3. **Announced**: Major changes announced on home screen
4. **Backward Compatible**: We won't reduce privacy protections

**Notification Method**: If we ever start collecting personal information (which we don't plan to), we will:
- Update this policy with clear explanation
- Require explicit opt-in (not opt-out)
- Notify users via prominent banner

---

## Contact

Questions about privacy or analytics?

- **Email**: [Insert contact email when available]
- **GitHub Issues**: [Link to GitHub repository issues]
- **Web Form**: [Link to contact form if implemented]

We typically respond within 48 hours.

---

## Legal Compliance

ChessChat is operated by [Your Legal Entity Name] and complies with:

- ✅ GDPR (EU General Data Protection Regulation)
- ✅ CCPA (California Consumer Privacy Act)
- ✅ COPPA (Children's Online Privacy Protection Act)
- ✅ PIPEDA (Canadian Personal Information Protection)
- ✅ Other applicable privacy laws

**Data Controller**: [Your Legal Entity Name]  
**Data Processor**: Cloudflare, Inc. (hosting), OpenAI, LLC (AI services)

---

## Summary (TL;DR)

**What we collect**:
- ✅ Anonymous usage counters (page loads, games started, etc.)

**What we DON'T collect**:
- ❌ Names, emails, IP addresses, or any personal information

**Your control**:
- ✅ Opt-out anytime via Settings toggle

**Data security**:
- ✅ Encrypted, Cloudflare-protected, rate-limited

**Third parties**:
- ✅ OpenAI (AI moves/chat) - 30-day retention, not used for training
- ✅ Cloudflare (hosting) - 7-day logs, infrastructure security only

**Bottom line**: ChessChat respects your privacy. We collect almost nothing, and what we do collect is completely anonymous.

---

**Last Updated**: December 10, 2025  
**Version**: 1.0  
**Effective Date**: December 10, 2025

For questions, contact: [Insert Contact Method]
