# ADR-005: Community Level Storage Strategy

## Status
Proposed (2026-05-09)

## Context
The community level system needs to store user-created levels, serve them to other players, track play statistics, and support ratings. The WeChat Cloud Development environment provides a MongoDB-like document database with per-collection quotas.

## Decision
Each community level is stored as a **single document** in the `community_levels` collection with the full level data embedded.

### Document schema
```json
{
  "_id": "auto-generated",
  "openid": "creator's WeChat openid",
  "title": "Level title (max 20 chars)",
  "levelData": {
    "board": [[...], ...],
    "difficulty": {...},
    "solution": [...],
    "minSteps": 8
  },
  "difficulty": 5,
  "tags": ["paradox", "chain"],
  "createdAt": "2026-05-09T12:00:00Z",
  "plays": 142,
  "clears": 38,
  "totalStars": 152,
  "avgRating": 4.0,
  "ratingCount": 38
}
```

### Limits
- Per user: max 5 published levels
- Level data size: < 10KB (enforced at publish time)
- Query: max 20 results per page
- Sorting: plays desc | createdAt desc | avgRating desc

### Cloud function actions
- `publishCommunityLevel` — insert
- `getCommunityLevels` — paginated query with sort
- `submitCommunityPlayResult` — update plays/clears/stars
- `rateCommunityLevel` — update rating

## Alternatives Considered

### A) Separate level data from metadata (two collections)
- **Rejected**: Adds join complexity; each level is small (< 10KB); single-document fetch is simpler

### B) File-based storage (cloud storage, not database)
- **Rejected**: No query support; can't sort/filter without loading all files; database is better for discoverability

### C) Unlimited publishing per user
- **Rejected**: Storage cost risk; quality dilution; 5-per-user limit encourages thoughtful creation

## Consequences
- **Positive**: Simple CRUD; single fetch for level data + metadata; easy to implement sorting/filtering
- **Negative**: Database size grows with user base; 5-level limit is arbitrary; no built-in content moderation
- **Risk**: Low-Medium — content moderation (inappropriate levels) not addressed; can add reporting mechanism later

## Related
- ADR-004 (Level Editor)
- `cloud/functions/leaderboard/index.js` — community actions
- `src/ui/CommunityBrowser.js` — browser UI
