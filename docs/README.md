# Chess Moments Documentation

This directory contains documentation for the Chess Moments project.

## 📚 Documentation Files

### For AI Assistants
- **[claude.md](./claude.md)** - Comprehensive guide for AI assistants (Claude) working on this project
  - Project overview and architecture
  - Key patterns and conventions
  - Common operations and debugging tips
  - Database schema and API conventions
  - Development workflow and best practices

### Architecture & Design
- **[tournament-video-architecture.md](./tournament-video-architecture.md)** - Complete architecture documentation for tournament video system
  - System overview
  - Data flow diagrams
  - Component descriptions
  - Technology stack

### Diagrams

#### Mermaid Source Files (.mmd)
- **[tournament-video-flow.mmd](./tournament-video-flow.mmd)** - Complete data flow diagram
- **[tournament-video-sequence.mmd](./tournament-video-sequence.mmd)** - Sequence diagram
- **[tournament-video-states.mmd](./tournament-video-states.mmd)** - State machine diagram

#### Rendered Diagrams (.svg)
- **[tournament-video-flow.svg](./tournament-video-flow.svg)** - Data flow visualization
- **[tournament-video-sequence.svg](./tournament-video-sequence.svg)** - Timeline of interactions
- **[tournament-video-states.svg](./tournament-video-states.svg)** - Video lifecycle states

## 🚀 Quick Start

### For Developers
1. Start by reading the main project README (if it exists in root)
2. Review [tournament-video-architecture.md](./tournament-video-architecture.md) for system design
3. Check out the diagrams for visual understanding

### For AI Assistants (Claude, etc.)
1. **Start here**: [claude.md](./claude.md)
2. Use it as a reference throughout the session
3. Update it when making significant changes

## 📖 How to Use These Docs

### Understanding the System
```
1. Read claude.md → Get project context and conventions
2. View SVG diagrams → Understand data flow visually
3. Read architecture.md → Deep dive into specific systems
```

### Making Changes
```
1. Follow patterns in claude.md
2. Update diagrams if architecture changes
3. Document new patterns and gotchas
```

### Regenerating Diagrams
```bash
# Install mermaid-cli globally (one time)
npm install -g @mermaid-js/mermaid-cli

# Or use npx (no installation)
npx -p @mermaid-js/mermaid-cli mmdc -i docs/file.mmd -o docs/file.svg -b transparent
```

## 🔧 Maintenance

### When to Update Documentation

**Update claude.md when**:
- Adding new architectural patterns
- Discovering gotchas or common mistakes
- Adding new major features
- Changing conventions or standards
- After significant refactoring

**Update architecture.md when**:
- Changing system architecture
- Adding new components or services
- Modifying data flows
- Updating technology stack

**Update diagrams when**:
- Data flow changes
- New states or transitions added
- API endpoints change significantly
- Component interactions change

## 📝 Document Templates

### Adding New Documentation

When adding new docs, consider:
1. **Purpose**: What problem does this doc solve?
2. **Audience**: Who is this for? (Developers, AI, both?)
3. **Scope**: What does it cover?
4. **Format**: Markdown, diagram, or code examples?
5. **Maintenance**: How often will it need updates?

### Diagram Best Practices

**Mermaid Diagrams**:
- Keep source files (.mmd) in version control
- Render to SVG for viewing
- Use consistent styling and colors
- Add clear labels and descriptions
- Test rendering before committing

## 🤖 AI Assistant Guidelines

If you're an AI assistant working on this project:

1. **Always start by reading [claude.md](./claude.md)**
   - It contains critical context and conventions
   - Saves time and prevents mistakes
   - Updated with lessons learned

2. **Reference architecture docs when needed**
   - Understand before modifying
   - Follow established patterns
   - Don't reinvent the wheel

3. **Update docs when you make changes**
   - Keep claude.md current
   - Update diagrams if needed
   - Document new patterns

4. **Use docs to maintain consistency**
   - Follow naming conventions
   - Use established patterns
   - Apply lessons learned

## 📊 Diagram Overview

### Flow Diagram
Shows the complete journey from user action to video completion:
- User interaction
- API processing
- Background AI generation
- Lambda rendering
- Progress polling
- Completion and YouTube upload

### Sequence Diagram
Shows the timeline of interactions between components:
- Request/response flows
- Async operations
- Polling behavior
- Service integrations

### State Machine
Shows the lifecycle of a tournament video:
- Initial creation (pending)
- AI script generation (generating_script)
- Video rendering (rendering)
- Completion (completed)
- Error handling (failed)

## 🔗 Related Resources

**External Documentation**:
- [Next.js Docs](https://nextjs.org/docs)
- [Remotion Docs](https://remotion.dev)
- [PostgreSQL Docs](https://postgresql.org/docs)
- [OpenRouter API](https://openrouter.ai/docs)
- [Clerk Authentication](https://clerk.com/docs)

**Project Files**:
- `/src/lib/db.ts` - Database functions
- `/src/lib/tournament-ai.ts` - AI generation
- `/src/remotion/` - Video compositions
- `/migrations/` - Database schema

---

**Last Updated**: 2025-10-30
**Maintained By**: Project team and AI assistants
