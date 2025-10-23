# Cortex Business Strategy

> **Internal Document** - Strategic planning for Cortex development and monetization
> 
> **Last Updated**: 2025-01-29  
> **Status**: Planning Phase

## Mission Statement

Enable developers to plug'n'play Convex+Cortex for fully functional, easy-to-deploy persistent memory structures for AI agents.

## Core Architecture

### Two-Tier Model

**Direct Mode (Open Source - MIT)**
- SDK connects directly to user's Convex instance
- User manages their own Convex deployment
- Free forever
- Core functionality available

**Cloud Mode (Managed Service - Commercial)**
- SDK routes through Cortex Cloud API
- Cortex Cloud connects to user's Convex instance via customer-managed keys
- Additional analytics, tools, and features
- Multiple pricing tiers

### Critical Constraint: Convex FSL License

Convex backend is licensed under FSL-1.1-Apache-2.0, which prohibits:
- ❌ Hosting Convex as a competing service
- ❌ Substituting for Convex Cloud
- ❌ Offering same/similar functionality as Convex

**Our Compliance Strategy:**
- ✅ Build tools and analytics ON TOP OF Convex
- ✅ User's data stays in their Convex instance
- ✅ We provide management layer, not infrastructure
- ✅ Symbiotic with Convex, not competitive

## Revenue Model (Planned)

### Phase 1: Community Building (0-6 months)
**Revenue:** $0  
**Focus:** 
- Open source SDK development
- Documentation and examples
- Community growth
- Prove product-market fit

**Success Metrics:**
- 1,000+ GitHub stars
- 100+ active users
- Positive community feedback
- Use cases documented

### Phase 2: Cloud Mode Beta (6-12 months)
**Revenue Target:** $5K-20K/month  
**Focus:**
- Launch Cortex Cloud private beta
- Build analytics dashboard (Cortex Studio)
- Develop migration tools
- Professional services offerings

**Pricing (Tentative):**
- **Free:** Direct mode (unlimited)
- **Pro:** $49/month (cloud mode, basic analytics)
- **Scale:** $199/month (advanced features)
- **Enterprise:** Custom pricing

### Phase 3: Scale & Partnership (12-18 months)
**Revenue Target:** $50K-100K/month  
**Focus:**
- Public launch of Cortex Cloud
- Convex partnership discussions
- Enterprise features (SSO, audit logs)
- Team collaboration tools

### Phase 4: Strategic Positioning (18-24+ months)
**Revenue Target:** $100K-500K/month  
**Options:**
- Convex official partner/acquisition
- Independent growth with funding
- Ecosystem leadership position

## Feature Differentiation (Draft)

> **Note**: Feature distribution between free/paid tiers is still being determined. The following is a working framework subject to change.

### Definitely Free (Direct Mode)
- ✅ Core memory operations (store, retrieve, search, delete)
- ✅ Basic agent management (string IDs)
- ✅ User profiles
- ✅ Context chains (basic)
- ✅ Conversation history
- ✅ All core SDK functionality

### Likely Paid (Cloud Mode)
- 📊 Advanced analytics dashboard
- 💰 Cost optimization recommendations
- 👥 Team collaboration features
- 🔄 Migration tools from other platforms
- 🎯 A2A communication tracking (possibly)
- 📈 Usage forecasting
- 🔍 Advanced search strategies
- 💼 Enterprise features (SSO, audit logs, SLA)

### To Be Determined
- Context chain advanced features
- Agent registry (may be free)
- Basic vs advanced analytics split
- A2A memory storage
- Multi-tenant features
- Performance optimization tools

## Competitive Positioning

### Not Competing With:
- ❌ Convex (we enhance, not replace)
- ❌ Vector databases (we're a complete memory system)
- ❌ LLM providers (embedding-agnostic)

### Competing With:
- ✅ DIY solutions (save dev time)
- ✅ LangChain/LlamaIndex memory (more powerful)
- ✅ Pinecone + custom code (simpler, all-in-one)

### Our Unique Value:
1. **Only** AI memory system built specifically for Convex
2. **Only** solution with both open source AND managed options
3. **Only** AI-specific analytics and optimization layer
4. Built by someone who's used it in production (Project Constellation)

## Partnership Strategy with Convex

### Value Proposition to Convex:
1. Drive adoption in AI/LLM market segment
2. Every Cortex user is a Convex customer
3. Increase Convex usage per customer
4. Strengthen Convex ecosystem
5. Handle AI-specific tooling so Convex can focus on infrastructure

### Potential Partnership Models:
- **Ecosystem Partner** - Featured in Convex marketplace
- **Co-Marketing** - Joint case studies and content
- **Revenue Share** - Referral fees for Convex signups
- **Reseller** - Bundle Cortex + Convex
- **Technology Partnership** - Joint roadmap planning
- **Investment/Acquisition** - Strategic alignment

### Outreach Plan:
- Week 1: Initial email to Convex team
- Month 3: Follow-up with early traction data
- Month 6: Formal partnership proposal
- Month 12: Deeper integration discussions

## Risk Mitigation

### Risk: Convex changes license or strategy
**Mitigation:** 
- Build on documented APIs
- Abstract Convex layer (theoretically portable)
- 2-year Apache conversion clause

### Risk: Low adoption of direct mode
**Mitigation:**
- Focus on exceptional docs and DX
- Build community through content
- Engage with AI/LLM communities early

### Risk: Can't differentiate free vs paid effectively
**Mitigation:**
- Start with everything free
- Let users tell us what they'd pay for
- Iterate based on feedback

### Risk: Convex sees us as competitor
**Mitigation:**
- Clear communication from day 1
- Transparent about helping their ecosystem
- Invite them to participate/guide
- Comply strictly with FSL license

## Success Criteria by Phase

### Phase 1 (Months 0-6)
- [ ] 1,000 GitHub stars
- [ ] 100 active users in production
- [ ] 10+ published use cases
- [ ] Active community (Discord/Discussions)
- [ ] Positive Convex relationship established

### Phase 2 (Months 6-12)
- [ ] Cloud mode launched to beta users
- [ ] 10+ paying customers
- [ ] $10K+ MRR
- [ ] Cortex Studio dashboard v1
- [ ] First enterprise customer

### Phase 3 (Months 12-18)
- [ ] Public cloud mode launch
- [ ] $50K+ MRR
- [ ] Official Convex partnership discussion
- [ ] 100+ paying customers
- [ ] Series A discussions (if independent path)

## Technical Priorities

### Q1 2025
1. Complete documentation foundation
2. Design and implement core SDK (direct mode)
3. Deploy example applications
4. Build community

### Q2 2025
1. Cloud mode infrastructure
2. Customer credential management (encrypted)
3. Basic analytics dashboard
4. Beta launch

### Q3 2025
1. Advanced analytics features
2. Migration tools
3. Team collaboration features
4. Public launch

### Q4 2025
1. Enterprise features (SSO, audit logs)
2. Advanced optimization tools
3. Scale infrastructure
4. Partnership formalization

## Decision Log

### 2025-01-29: Licensing Model Finalized
- **Decision:** Open source core (MIT) + commercial cloud service
- **Rationale:** Convex FSL prevents competing hosting; this model is compliant and better aligned
- **Impact:** Changed from potential "Cortex Cloud hosting Convex" to "tools on top of user's Convex"

### 2025-01-29: Feature Tiers
- **Decision:** Keep feature differentiation flexible during development
- **Rationale:** Need user feedback to determine what's valuable enough to charge for
- **Impact:** Documentation uses generic language about "advanced features"

## Open Questions

1. **Exact free/paid feature split** - TBD based on user feedback
2. **Pricing model details** - Usage-based vs flat fee vs hybrid?
3. **Convex partnership timeline** - When to formally propose?
4. **Funding strategy** - Bootstrap vs raise vs acquire?
5. **International expansion** - When and how?
6. **Team building** - Timeline for first hires?

## Principles

### Non-Negotiables
1. **Open source core stays open** - No rug pulls
2. **Data ownership** - User's data in their Convex instance
3. **Convex alignment** - Never compete with them
4. **Developer-first** - DX over revenue in early stages
5. **Transparency** - Build in public, honest communication

### Flexible
1. Exact feature distribution (free vs paid)
2. Pricing structure
3. Timeline (adjust based on traction)
4. Partnership vs independence
5. Team structure

## Next Actions

### Immediate (This Week)
- [x] Finalize documentation structure
- [x] Update docs with dual-mode architecture
- [ ] Draft Convex partnership introduction email
- [ ] Set up GitHub repository
- [ ] Begin SDK development

### Short Term (1-3 Months)
- [ ] Complete direct mode SDK
- [ ] Publish 5+ example applications
- [ ] Write launch blog post
- [ ] Product Hunt / Hacker News launch
- [ ] First 100 users

### Medium Term (3-6 Months)
- [ ] Build Cortex Cloud infrastructure
- [ ] Private beta launch (10-20 users)
- [ ] First paying customer
- [ ] Convex partnership follow-up

---

**Document Owner:** Nicholas Geil / Saint Nick LLC  
**Review Cadence:** Monthly or as major decisions are made  
**Distribution:** Internal only

---

## Appendix: Market Research Notes

*(To be added as research is conducted)*

- Competitor analysis
- User interviews
- Pricing research
- Market size estimates
- Growth projections

