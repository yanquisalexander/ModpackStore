# Like/Dislike and Recommendation System - Visual Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MODPACKSTORE ARCHITECTURE                        │
│                   Like/Dislike & Recommendation System                  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Tauri + React)                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │  VoteButtons     │  │ Recommended      │  │ RelatedModpacks  │     │
│  │                  │  │ Modpacks         │  │                  │     │
│  │ - Like Button    │  │                  │  │ "Users who liked │     │
│  │ - Dislike Button │  │ "For You"        │  │ this also..."    │     │
│  │ - Vote Counts    │  │ - UBCF Results   │  │ - Item-Based     │     │
│  │ - Optimistic UI  │  │ - Fallback       │  │ - Query-Based    │     │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘     │
│           │                     │                     │                 │
│           └─────────────────────┴─────────────────────┘                 │
│                                 │                                        │
└─────────────────────────────────┼────────────────────────────────────────┘
                                  │
                                  │ HTTP/REST API
                                  │
┌─────────────────────────────────▼────────────────────────────────────────┐
│                        BACKEND (Node.js + TypeORM)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                         API ROUTES                              │    │
│  │  /api/v1/votes/*          /api/v1/recommendations/*            │    │
│  └────────────────────────────────────────────────────────────────┘    │
│           │                                    │                         │
│           ▼                                    ▼                         │
│  ┌──────────────────┐              ┌────────────────────┐              │
│  │  VoteController  │              │ RecommendationCtrl │              │
│  └────────┬─────────┘              └──────────┬─────────┘              │
│           │                                    │                         │
│           ▼                                    ▼                         │
│  ┌──────────────────┐              ┌────────────────────┐              │
│  │   VoteService    │              │ RecommendationSvc  │              │
│  │                  │              │                    │              │
│  │ - voteOnModpack  │              │ - generateAll      │              │
│  │ - getVoteCounts  │              │ - generateForUser  │              │
│  │ - getUserVotes   │              │ - getForYou        │              │
│  │                  │              │ - getRelatedTo     │              │
│  └────────┬─────────┘              │                    │              │
│           │                        │ UBCF ALGORITHM:    │              │
│           │                        │ 1. Build Matrix    │              │
│           │                        │ 2. Calc Similarity │              │
│           │                        │ 3. Find K-NN       │              │
│           │                        │ 4. Generate Recs   │              │
│           │                        │ 5. Store Results   │              │
│           │                        └──────────┬─────────┘              │
│           │                                   │                         │
└───────────┼───────────────────────────────────┼─────────────────────────┘
            │                                   │
            ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE (PostgreSQL)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐              ┌────────────────────┐              │
│  │  modpack_votes   │              │ user_recommendations│             │
│  │                  │              │                    │              │
│  │ - userId (PK)    │              │ - userId (PK)      │              │
│  │ - modpackId (PK) │              │ - modpackId (PK)   │              │
│  │ - vote (1/-1)    │              │ - score            │              │
│  │ - createdAt      │              │ - algorithm        │              │
│  │ - updatedAt      │              │ - createdAt        │              │
│  │                  │              │ - updatedAt        │              │
│  │ UNIQUE(userId,   │              │                    │              │
│  │  modpackId)      │              │                    │              │
│  └──────────────────┘              └────────────────────┘              │
│           ▲                                   ▲                         │
│           │                                   │                         │
│           └────────────┬──────────────────────┘                         │
│                        │                                                │
└────────────────────────┼────────────────────────────────────────────────┘
                         │
                         │
┌────────────────────────▼────────────────────────────────────────────────┐
│                       BACKGROUND JOB (Cron)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │  generate-recommendations.ts                                  │      │
│  │                                                                │      │
│  │  1. Fetch all votes from DB                                   │      │
│  │  2. Build user-item matrix                                    │      │
│  │  3. For each user:                                            │      │
│  │     a. Calculate similarity with other users (Cosine)         │      │
│  │     b. Select K=10 most similar users                         │      │
│  │     c. Find modpacks liked by similar users                   │      │
│  │     d. Calculate weighted recommendation scores               │      │
│  │     e. Store top 20 recommendations in DB                     │      │
│  │  4. Log completion                                            │      │
│  │                                                                │      │
│  │  Schedule: Daily at 3 AM (configurable via cron)              │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                            DATA FLOW DIAGRAM                             │
└─────────────────────────────────────────────────────────────────────────┘

USER VOTES ON MODPACK:
User → VoteButtons → POST /votes → VoteService → DB (modpack_votes)
                                        ↓
                                 Update Counts
                                        ↓
                                  Return to UI
                                        ↓
                            Optimistic UI Update

VIEWING RECOMMENDATIONS:
User → RecommendedModpacks → GET /recommendations/for-you → DB (user_recommendations)
                                                                      ↓
                                                              Fetch Modpack Data
                                                                      ↓
                                                              Return JSON:API
                                                                      ↓
                                                                Display Grid

BACKGROUND GENERATION:
Cron Job → generate-recommendations.ts → Fetch Votes → Build Matrix
                                              ↓
                                      Calculate Similarities
                                              ↓
                                         Find Neighbors
                                              ↓
                                      Generate Scores
                                              ↓
                                   Store in user_recommendations


┌─────────────────────────────────────────────────────────────────────────┐
│                      UBCF ALGORITHM VISUALIZATION                        │
└─────────────────────────────────────────────────────────────────────────┘

STEP 1: User-Item Matrix
          MP1  MP2  MP3  MP4  MP5
User A    1    -1    0    1    0
User B    1     0    1   -1    0
User C   -1     1    1    0    1
User D    0     1   -1    1    0

STEP 2: Calculate Similarity (Cosine)
User A vs User B: sim = 0.67
User A vs User C: sim = -0.33 (excluded, < 0)
User A vs User D: sim = 0.82

STEP 3: Select K=10 Nearest Neighbors
For User A: [User D (0.82), User B (0.67)]

STEP 4: Generate Recommendations
User D liked MP2, MP4 → Already voted by A (MP4)
User D liked MP2 → Recommend MP2 to A (weighted by 0.82)
User B liked MP3 → Recommend MP3 to A (weighted by 0.67)

STEP 5: Store Results
user_recommendations:
- userId: A, modpackId: MP2, score: 0.82, algorithm: "ubcf"
- userId: A, modpackId: MP3, score: 0.67, algorithm: "ubcf"


┌─────────────────────────────────────────────────────────────────────────┐
│                         COLD START STRATEGY                              │
└─────────────────────────────────────────────────────────────────────────┘

New User (No Votes):
    ↓
Check Vote History → Empty
    ↓
Generate Fallback Recommendations:
    ├─ Popular Modpacks (score: 1.0 - 0.95 - 0.90...)
    └─ New Modpacks (score: 0.7 - 0.67 - 0.64...)
    ↓
Store with algorithm: "popular" or "new"
    ↓
Display to User with label "Quizá te guste..."


┌─────────────────────────────────────────────────────────────────────────┐
│                      SECURITY & PERFORMANCE                              │
└─────────────────────────────────────────────────────────────────────────┘

SECURITY:
✓ All vote endpoints require authentication
✓ JWT tokens validated on each request
✓ Input validation (like/dislike/none only)
✓ SQL injection prevention via TypeORM
✓ Unique constraint prevents vote spamming
✓ Admin-only access for batch generation

PERFORMANCE:
✓ Pre-calculated recommendations (not real-time)
✓ Database indexes on vote tables
✓ Batch processing for efficiency
✓ Limited result sets (top 20 per user)
✓ Background job runs off-peak hours
✓ Optimistic UI updates for responsiveness

SCALABILITY:
→ O(N²) complexity for similarity calculation
→ Mitigated by batch processing
→ Future: Consider Redis caching
→ Future: Distributed processing for large N
```
