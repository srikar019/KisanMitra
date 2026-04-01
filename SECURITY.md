# Security Implementation Guide

## Overview

This document describes the security measures implemented in KisanMitra to protect user data, secure API keys, and prevent common web vulnerabilities.

## ✅ Security Improvements Implemented

### 1. Content Security Policy (CSP) Headers

**Location**: `firebase.json`

Comprehensive CSP headers protect against XSS, clickjacking, and other injection attacks:

```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  connect-src 'self' https://*.googleapis.com https://*.cloudfunctions.net;
```

Additional security headers:
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: SAMEORIGIN` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - Enables XSS filter
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Permissions-Policy` - Restricts camera, microphone, geolocation

### 2. Server-side API Key Protection

**Problem Solved**: API keys were exposed in client bundle

**Solution**: Firebase Cloud Functions handle all AI API calls server-side

**Location**: `functions/src/index.ts`

```typescript
// API keys stored securely in Firebase Functions config
const geminiApiKey = functions.config().gemini?.api_key;
const exaApiKey = functions.config().exa?.api_key;

// Client only calls secure endpoints
// No API keys in client code
```

**Setup**:
```bash
firebase functions:config:set gemini.api_key="YOUR_KEY"
firebase functions:config:set exa.api_key="YOUR_KEY"
```

### 3. Server-side Input Validation

**Problem Solved**: All validation was client-side only

**Solution**: Comprehensive server-side validation middleware

**Location**: `functions/src/validation.ts`

All inputs validated before processing:
- ✅ Email format validation
- ✅ Location string validation (2-200 chars)
- ✅ Image data validation (format, size max 4MB)
- ✅ MIME type whitelisting
- ✅ Language code validation
- ✅ Numeric range validation
- ✅ XSS sanitization

### 4. Rate Limiting

**Location**: `functions/src/index.ts`

Prevents abuse and DoS attacks:
- **Limit**: 20 requests per minute per user
- **Enforcement**: Server-side middleware
- **Response**: HTTP 429 (Too Many Requests)
- **Cleanup**: Automatic every 5 minutes

### 5. Firebase Authentication

All Cloud Function endpoints require valid Firebase Auth token:

```typescript
const verifyAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  req.user = decodedToken;
  next();
};
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Client (Browser)                       │
│  - No API keys exposed                                   │
│  - Client-side validation for UX only                   │
│  - Firebase Auth tokens                                 │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ HTTPS + Auth Token
                  ↓
┌─────────────────────────────────────────────────────────┐
│          Firebase Cloud Functions (Secure)              │
│  ✓ Verify Auth Token                                   │
│  ✓ Rate Limiting (20 req/min)                          │
│  ✓ Server-side Validation                              │
│  ✓ XSS Sanitization                                    │
│  ✓ Secure API Keys                                     │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Authenticated Requests
                  ↓
┌─────────────────────────────────────────────────────────┐
│              External APIs (Gemini, Exa)                │
│  - API keys never exposed to client                     │
└─────────────────────────────────────────────────────────┘
```

## Firestore Security Rules

**Location**: `firestore.rules`

Comprehensive role-based access control:

### Key Rules:
1. **Users**: Can only read/write own profile, no role escalation
2. **Products**: Authenticated users read, only owners modify
3. **Orders**: Transaction-based with stock validation
4. **Notifications**: Recipients can only read own notifications
5. **Chats**: Only participants can access
6. **Admin**: Separate admin-only collections

### Example Rules:
```javascript
// Users can only modify their own profile
match /users/{userId} {
  allow read: if isAuthenticated();
  allow update: if isOwner(userId) && 
    // Prevent role escalation
    request.resource.data.role == resource.data.role;
}

// Products require authentication and ownership
match /products/{productId} {
  allow create: if isAuthenticated() &&
    request.resource.data.farmerUid == request.auth.uid &&
    request.resource.data.quantity > 0;
  allow update, delete: if resource.data.farmerUid == request.auth.uid;
}
```

## Best Practices Implemented

### ✅ Input Sanitization
```typescript
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};
```

### ✅ Parameterized Queries
Firestore queries use parameterization to prevent injection:
```typescript
firestore.collection('products')
  .where('farmerUid', '==', userId)
  .where('status', '==', 'active')
  .get();
```

### ✅ HTTPS Enforcement
```javascript
// In firebase.json
"headers": [{
  "key": "upgrade-insecure-requests",
  "value": ""
}]
```

### ✅ Token Expiration
Firebase Auth tokens auto-expire after 1 hour

### ✅ Secure Password Storage
Firebase Auth handles password hashing (bcrypt)

## Migration Guide

### For Existing Client Code

Replace direct Gemini/Exa calls with Cloud Functions:

**Before** (insecure):
```typescript
// services/geminiService.ts
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); // EXPOSED!
const response = await ai.models.generateContent({...});
```

**After** (secure):
```typescript
// services/geminiService.ts
const response = await fetch('https://your-region-project.cloudfunctions.net/api/detectCropDisease', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ imageBase64, mimeType, language })
});
```

## Deployment Checklist

- [ ] Set Firebase Functions config:
  ```bash
  firebase functions:config:set gemini.api_key="KEY"
  firebase functions:config:set exa.api_key="KEY"
  ```
- [ ] Remove API keys from client `.env` files
- [ ] Update CORS origins in `functions/src/index.ts`
- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Deploy Cloud Functions: `firebase deploy --only functions`
- [ ] Deploy hosting with CSP: `firebase deploy --only hosting`
- [ ] Test all endpoints with valid auth tokens
- [ ] Verify CSP headers: `curl -I https://your-app.web.app`
- [ ] Test rate limiting (make 21 requests quickly)
- [ ] Check Firebase Console for function logs

## Security Testing

### Test CSP Headers
```bash
curl -I https://your-app.web.app
# Look for: Content-Security-Policy, X-Frame-Options, etc.
```

### Test Auth Protection
```bash
# Should fail with 401
curl -X POST https://your-project.cloudfunctions.net/api/detectCropDisease
```

### Test Rate Limiting
```bash
# Make 21 requests quickly - 21st should return 429
for i in {1..21}; do
  curl -X POST https://your-project.cloudfunctions.net/api/health \
    -H "Authorization: Bearer $TOKEN"
done
```

### Test Input Validation
```bash
# Should fail with 400
curl -X POST https://your-project.cloudfunctions.net/api/detectCropDisease \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"mimeType": "application/exe"}'  # Invalid MIME type
```

## Monitoring & Alerts

### Firebase Console
Monitor security events in:
- **Authentication** → Users → Activity
- **Functions** → Logs → Filter by status code 401, 429
- **Firestore** → Rules → Denied requests

### Recommended Alerts
1. High rate of 401 errors (potential attack)
2. High rate of 429 errors (abuse or legitimate traffic spike)
3. Failed Firestore rule checks
4. Unusual geographic access patterns

## Incident Response

If security breach suspected:

1. **Immediate**:
   - Rotate API keys: `firebase functions:config:set gemini.api_key="NEW_KEY"`
   - Revoke user sessions: Firebase Console → Authentication → Revoke all
   - Deploy updated config: `firebase deploy --only functions`

2. **Investigation**:
   - Check Cloud Function logs
   - Review Firestore audit logs
   - Check for unauthorized data access

3. **Communication**:
   - Notify affected users
   - Document incident
   - Update security measures

## Additional Recommendations

### High Priority
1. ✅ Implement IP-based rate limiting (using Cloud Armor)
2. ✅ Add Redis/Memorystore for distributed rate limiting
3. ✅ Enable Firebase App Check for device attestation
4. ✅ Add Content Security Policy reporting
5. ✅ Implement CAPTCHA for high-risk operations

### Medium Priority
1. Set up security monitoring (Cloud Security Command Center)
2. Enable DDoS protection (Cloud Armor)
3. Add webhook signature validation
4. Implement audit logging
5. Regular security audits

### Low Priority
1. Add security.txt file
2. Implement HSTS preloading
3. Set up bug bounty program
4. Add security response team contact

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Rules Guide](https://firebase.google.com/docs/rules)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [Cloud Functions Best Practices](https://firebase.google.com/docs/functions/best-practices)

## Security Contact

For security issues, please contact: security@your-domain.com

**Do NOT open public GitHub issues for security vulnerabilities.**
