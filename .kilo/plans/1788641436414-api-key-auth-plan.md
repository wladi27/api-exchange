# API Key Authentication & Professional Documentation Plan

## Objective
Add API key authentication to the Node.js BCV Exchange API, create professional documentation, and provide usage examples from multiple languages.

## Decisions Made
- **Key Storage**: JSON file (`api-keys.json`) stored in project root, gitignored
- **Key Management**: CLI script (`scripts/manage-keys.js`) for generate/list/revoke operations
- **Python Version**: Leave unchanged per user request

## Implementation Tasks

### 1. Key Storage & Management
- Create `api-keys.json` with structure: `{ keys: [], metadata: {} }`
- Each key object: `{ key: string, name: string, created_at: ISO8601, last_used: ISO8601|null, active: boolean }`
- Create `scripts/manage-keys.js` with commands:
  - `node scripts/manage-keys.js generate --name "My App"`
  - `node scripts/manage-keys.js list`
  - `node scripts/manage-keys.js revoke <key>`

### 2. API Key Middleware (`app.js`)
- Add `x-api-key` header validation middleware
- Return `401 Unauthorized` with JSON error for missing/invalid keys
- Apply middleware to all `/api/v1/*` routes except `/docs` and `/`
- Add rate limiting: 100 requests per minute per API key (in-memory store)
- Log key usage: `last_used` timestamp update on successful requests

### 3. Documentation Updates (`docs.html`)
- Add "Authentication" section explaining API key requirement
- Add "Getting Started" section with 3-step setup:
  1. Generate API key via CLI
  2. Include in request headers
  3. Monitor usage
- Update all code examples to include `X-Api-Key` header
- Add rate limiting info (100 req/min)
- Add response schema for errors (401, 429)

### 4. Multi-Language Usage Examples (`docs.html`)
Add new "SDK Examples" section with:
- **JavaScript (Fetch)**: Browser and Node.js examples
- **Python**: `requests` library example
- **cURL**: Command line example
- **PHP**: cURL example
- **Go**: `net/http` example
- **Java**: `HttpURLConnection` example

Each example must show:
- Correct `X-Api-Key` header usage
- Error handling for 401/429
- Parsing successful JSON response

### 5. Environment Configuration
- Add `.env.example` with `API_KEYS_FILE=api-keys.json` and `RATE_LIMIT_MAX_REQUESTS=100`
- Update `package.json` scripts to include `node scripts/manage-keys.js generate`

### 6. Security Considerations
- Keys stored as plaintext in JSON (acceptable for small deployments, document this)
- File permissions: recommend `chmod 600 api-keys.json` on Unix
- No key logging in application logs
- Keys must be at least 32 characters, generated with `crypto.randomBytes(32).toString('hex')`

## Validation Plan
1. Run `node scripts/manage-keys.js generate --name "Test"` - verify key creation
2. Start server, call endpoint without key - verify 401
3. Call endpoint with invalid key - verify 401
4. Call endpoint with valid key - verify 200 with data
5. Verify docs.html loads and examples are syntactically correct
6. Check `api-keys.json` is in `.gitignore`

## Files to Create/Modify
- Create: `api-keys.json`
- Create: `scripts/manage-keys.js`
- Create: `.env.example`
- Modify: `app.js` (add middleware, rate limiting)
- Modify: `docs.html` (auth docs, updated examples)
- Modify: `.gitignore` (ensure api-keys.json is ignored)
- Modify: `package.json` (add scripts)
