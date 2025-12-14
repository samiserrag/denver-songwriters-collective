# White-Label Community Platform Architecture Plan

**Project:** Denver Songwriters Collective → Reusable Community Platform Template
**Status:** DRAFT - Pending Expert Review
**Created:** December 2024
**Author:** Claude (AI Assistant)

---

## Executive Summary

Transform the Denver Songwriters Collective codebase into a **white-label community platform** that can be:
1. Quickly re-themed for different brands/projects
2. Deployed as both web app and mobile app (iOS/Android)
3. Configured via a single configuration file per brand
4. Extended with brand-specific features without forking

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target Architecture](#2-target-architecture)
3. [Theme System Design](#3-theme-system-design)
4. [Brand Configuration System](#4-brand-configuration-system)
5. [Mobile App Strategy](#5-mobile-app-strategy)
6. [Implementation Phases](#6-implementation-phases)
7. [File Structure Changes](#7-file-structure-changes)
8. [Migration Guide](#8-migration-guide)
9. [Open Questions for Review](#9-open-questions-for-review)

---

## 1. Current State Analysis

### What We Have
- **Framework:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Deployment:** Vercel
- **Styling:** Mix of CSS variables in `globals.css` and hardcoded Tailwind classes

### Audit Results (December 2024)

| Category | Current State | Issue |
|----------|--------------|-------|
| Colors | 15 CSS variables defined | ~24 unique hex colors hardcoded in 40+ files |
| Typography | Font variables exist | 111 files use hardcoded `font-bold`, `text-lg`, etc. |
| Shadows | 5 shadow variables | 18 files use inline `shadow-[...]` values |
| Gradients | 2-3 gradient classes | 9 files have hardcoded gradient values |
| Border Radius | 6 radius variables | 109 files use hardcoded `rounded-*` classes |
| Spacing | 4 custom spacing vars | Standard Tailwind spacing used throughout |

### Hardcoded Values Found
```
#d4a853 (18 occurrences) - gold accent
#737373 (17 occurrences) - gray text
#0a0a0a (15 occurrences) - near-black
#a3a3a3 (14 occurrences) - light gray
#060F2C (body background) - dark indigo
+ 20 more unique colors
```

---

## 2. Target Architecture

### Goals
1. **Single Source of Truth:** One config file defines an entire brand's look and feel
2. **Zero Code Changes for Theming:** Switch themes without touching component files
3. **Type Safety:** Full TypeScript support for theme/brand configuration
4. **Mobile Parity:** Same theme system works in React Native
5. **Runtime Switching:** Support dark/light mode and potentially user-selected themes

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Brand Config                              │
│  /config/brands/denver-songwriters.ts                           │
│  /config/brands/austin-musicians.ts                             │
│  /config/brands/[your-brand].ts                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Theme Generator                             │
│  Converts brand config → CSS variables + Tailwind config        │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
        ┌───────────────────┐   ┌───────────────────┐
        │    Web App        │   │   Mobile App      │
        │  (Next.js)        │   │  (React Native)   │
        │                   │   │                   │
        │  CSS Variables    │   │  StyleSheet       │
        │  Tailwind v4      │   │  + Theme Context  │
        └───────────────────┘   └───────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    ┌───────────────────┐
                    │    Supabase       │
                    │  (shared backend) │
                    └───────────────────┘
```

---

## 3. Theme System Design

### 3.1 Design Token Hierarchy

We'll use a **three-tier token system**:

```
Tier 1: Primitive Tokens (raw values)
    └── colors.blue.500: "#3B82F6"
    └── colors.gold.400: "#FFD86A"
    └── spacing.4: "1rem"

Tier 2: Semantic Tokens (purpose-based)
    └── color.background.primary: colors.indigo.950
    └── color.text.primary: colors.warmWhite
    └── color.accent.primary: colors.gold.400

Tier 3: Component Tokens (specific usage)
    └── card.background: color.background.secondary
    └── card.border: color.border.subtle
    └── button.primary.background: color.accent.primary
```

### 3.2 Complete Token Schema

```typescript
// /config/theme.types.ts

export interface ThemeConfig {
  name: string;
  displayName: string;

  colors: {
    // Backgrounds
    background: {
      primary: string;      // Main page background
      secondary: string;    // Elevated surfaces (cards, modals)
      tertiary: string;     // Subtle differentiation
      inverse: string;      // For contrast sections
    };

    // Text
    text: {
      primary: string;      // Main body text
      secondary: string;    // Subdued text
      tertiary: string;     // Hints, placeholders
      inverse: string;      // Text on inverse backgrounds
      accent: string;       // Highlighted text
    };

    // Accent/Brand
    accent: {
      primary: string;      // Main brand color
      primaryHover: string;
      primaryMuted: string; // Subtle accent backgrounds
      secondary: string;    // Secondary brand color
    };

    // Borders
    border: {
      default: string;
      subtle: string;
      accent: string;
    };

    // Semantic
    semantic: {
      success: string;
      successMuted: string;
      warning: string;
      warningMuted: string;
      error: string;
      errorMuted: string;
      info: string;
      infoMuted: string;
    };

    // Interactive states
    interactive: {
      hover: string;
      focus: string;
      active: string;
      disabled: string;
    };
  };

  typography: {
    fontFamily: {
      sans: string;
      serif: string;
      mono: string;
    };

    fontSize: {
      displayXl: string;    // Hero headlines
      displayLg: string;
      display: string;
      headingXl: string;    // Page titles
      headingLg: string;
      heading: string;      // Section titles
      headingSm: string;
      bodyLg: string;
      body: string;
      bodySm: string;
      caption: string;
    };

    fontWeight: {
      light: number;
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };

    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };

    letterSpacing: {
      tight: string;
      normal: string;
      wide: string;
    };
  };

  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };

  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    full: string;
  };

  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    glow: string;         // Brand-colored glow
    glowStrong: string;
    card: string;
    cardHover: string;
  };

  gradients: {
    background: string;     // Page background gradient
    card: string;          // Card background
    cardHover: string;
    hero: string;          // Hero section overlay
    accent: string;        // Accent gradient (buttons, etc.)
    text: string;          // Text gradient effect
  };

  effects: {
    glassMorphism: {
      background: string;
      blur: string;
      border: string;
    };
    transition: {
      fast: string;
      normal: string;
      slow: string;
    };
  };

  // Component-specific overrides
  components: {
    button: {
      borderRadius: string;
      fontWeight: number;
      textTransform: 'none' | 'uppercase' | 'capitalize';
    };
    card: {
      borderRadius: string;
      padding: string;
    };
    input: {
      borderRadius: string;
      borderWidth: string;
    };
    avatar: {
      borderRadius: string;
    };
  };
}
```

### 3.3 Example Theme Definitions

```typescript
// /config/brands/denver-songwriters.ts

import { ThemeConfig } from '../theme.types';

export const denverSongwritersTheme: ThemeConfig = {
  name: 'denver-songwriters',
  displayName: 'Denver Songwriters Collective',

  colors: {
    background: {
      primary: '#060F2C',      // Deep indigo
      secondary: '#0E1629',    // Slightly lighter
      tertiary: '#1E1B4B',     // Card backgrounds
      inverse: '#FAF9F7',      // Light sections
    },
    text: {
      primary: '#FAF9F7',      // Warm white
      secondary: '#A8A29E',    // Warm gray
      tertiary: '#78716C',     // Darker gray
      inverse: '#060F2C',
      accent: '#FFD86A',       // Gold
    },
    accent: {
      primary: '#FFD86A',      // Gold
      primaryHover: '#FFCA3A',
      primaryMuted: 'rgba(255, 216, 106, 0.15)',
      secondary: '#38BDF8',    // Sky blue
    },
    border: {
      default: 'rgba(255, 255, 255, 0.1)',
      subtle: 'rgba(255, 255, 255, 0.05)',
      accent: 'rgba(255, 216, 106, 0.3)',
    },
    semantic: {
      success: '#10B981',
      successMuted: 'rgba(16, 185, 129, 0.15)',
      warning: '#F59E0B',
      warningMuted: 'rgba(245, 158, 11, 0.15)',
      error: '#EF4444',
      errorMuted: 'rgba(239, 68, 68, 0.15)',
      info: '#3B82F6',
      infoMuted: 'rgba(59, 130, 246, 0.15)',
    },
    interactive: {
      hover: 'rgba(255, 216, 106, 0.1)',
      focus: 'rgba(255, 216, 106, 0.5)',
      active: 'rgba(255, 216, 106, 0.2)',
      disabled: 'rgba(255, 255, 255, 0.3)',
    },
  },

  typography: {
    fontFamily: {
      sans: '"Inter", system-ui, sans-serif',
      serif: '"Playfair Display", Georgia, serif',
      mono: '"Geist Mono", monospace',
    },
    fontSize: {
      displayXl: '4.5rem',
      displayLg: '3.75rem',
      display: '3rem',
      headingXl: '2.25rem',
      headingLg: '1.875rem',
      heading: '1.5rem',
      headingSm: '1.25rem',
      bodyLg: '1.125rem',
      body: '1rem',
      bodySm: '0.875rem',
      caption: '0.75rem',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.1,
      normal: 1.5,
      relaxed: 1.75,
    },
    letterSpacing: {
      tight: '-0.02em',
      normal: '0',
      wide: '0.05em',
    },
  },

  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
    '4xl': '6rem',
  },

  borderRadius: {
    none: '0',
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },

  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.3)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.4)',
    glow: '0 0 20px rgba(255, 216, 106, 0.25)',
    glowStrong: '0 0 40px rgba(255, 216, 106, 0.35)',
    card: '0 4px 20px rgba(0, 0, 0, 0.25)',
    cardHover: '0 8px 30px rgba(0, 0, 0, 0.35), 0 0 20px rgba(255, 216, 106, 0.1)',
  },

  gradients: {
    background: 'linear-gradient(180deg, #0C1A47 0%, #060F2C 50%, #040A1F 100%)',
    card: 'linear-gradient(180deg, rgba(14, 22, 41, 0.95) 0%, rgba(6, 15, 44, 0.98) 100%)',
    cardHover: 'radial-gradient(circle at top, rgba(255, 216, 106, 0.12), rgba(6, 15, 44, 1))',
    hero: 'linear-gradient(to top, rgba(6, 15, 44, 0.95), transparent 50%)',
    accent: 'linear-gradient(90deg, #FFE68A, #FFD86A, #FFCA3A)',
    text: 'linear-gradient(90deg, #FFE68A, #FFD86A, #FFCA3A)',
  },

  effects: {
    glassMorphism: {
      background: 'rgba(14, 22, 41, 0.8)',
      blur: '12px',
      border: 'rgba(255, 255, 255, 0.1)',
    },
    transition: {
      fast: '150ms ease',
      normal: '300ms ease',
      slow: '500ms ease',
    },
  },

  components: {
    button: {
      borderRadius: '9999px',
      fontWeight: 600,
      textTransform: 'none',
    },
    card: {
      borderRadius: '1.5rem',
      padding: '1.5rem',
    },
    input: {
      borderRadius: '0.5rem',
      borderWidth: '1px',
    },
    avatar: {
      borderRadius: '9999px',
    },
  },
};
```

```typescript
// /config/brands/light-warm.ts - Example light theme

import { ThemeConfig } from '../theme.types';

export const lightWarmTheme: ThemeConfig = {
  name: 'light-warm',
  displayName: 'Light & Warm',

  colors: {
    background: {
      primary: '#FFFBF5',      // Warm cream
      secondary: '#FFF8ED',    // Slightly darker cream
      tertiary: '#FEF3E2',     // Card backgrounds
      inverse: '#1F2937',      // Dark sections
    },
    text: {
      primary: '#1F2937',      // Dark gray
      secondary: '#4B5563',    // Medium gray
      tertiary: '#9CA3AF',     // Light gray
      inverse: '#FFFBF5',
      accent: '#D97706',       // Amber
    },
    accent: {
      primary: '#F59E0B',      // Amber
      primaryHover: '#D97706',
      primaryMuted: 'rgba(245, 158, 11, 0.15)',
      secondary: '#06B6D4',    // Cyan
    },
    border: {
      default: 'rgba(0, 0, 0, 0.1)',
      subtle: 'rgba(0, 0, 0, 0.05)',
      accent: 'rgba(245, 158, 11, 0.3)',
    },
    // ... rest of semantic/interactive colors
  },

  gradients: {
    background: 'linear-gradient(180deg, #FFFBF5 0%, #FEF3E2 100%)',
    card: 'linear-gradient(180deg, #FFFFFF 0%, #FFFBF5 100%)',
    hero: 'linear-gradient(to top, rgba(255, 251, 245, 0.95), transparent 50%)',
    // ... etc
  },

  // ... rest matches structure but with light values
};
```

---

## 4. Brand Configuration System

Beyond theming, a white-label platform needs brand-specific content and features.

### 4.1 Brand Config Schema

```typescript
// /config/brand.types.ts

export interface BrandConfig {
  // Identity
  id: string;
  name: string;
  tagline: string;
  description: string;

  // Assets
  assets: {
    logo: string;           // Path to logo
    logoAlt: string;        // Alt text
    favicon: string;
    ogImage: string;        // Default social share image
    heroImage: string;
    heroVideo?: string;
  };

  // Contact
  contact: {
    email: string;
    phone?: string;
    address?: string;
    socialLinks: {
      instagram?: string;
      facebook?: string;
      twitter?: string;
      youtube?: string;
      spotify?: string;
      tiktok?: string;
    };
  };

  // Features (toggle on/off)
  features: {
    events: boolean;
    openMics: boolean;
    performers: boolean;
    studios: boolean;
    blog: boolean;
    gallery: boolean;
    tipJar: boolean;
    spotlight: boolean;
    map: boolean;
    comments: boolean;
    favorites: boolean;
    rsvp: boolean;
    studioBooking: boolean;
  };

  // Content customization
  content: {
    navigation: {
      label: string;
      href: string;
      enabled: boolean;
    }[];

    homepage: {
      heroTitle: string;
      heroSubtitle: string;
      ctaText: string;
      ctaLink: string;
      sections: ('highlights' | 'events' | 'spotlight' | 'blog' | 'cta')[];
    };

    footer: {
      copyright: string;
      links: { label: string; href: string }[];
    };
  };

  // Terminology customization
  terminology: {
    event: string;           // "Event" | "Gig" | "Show"
    eventPlural: string;
    performer: string;       // "Performer" | "Artist" | "Musician"
    performerPlural: string;
    host: string;            // "Host" | "Organizer" | "Venue"
    hostPlural: string;
    member: string;          // "Member" | "User" | "Community Member"
    memberPlural: string;
  };

  // SEO
  seo: {
    titleTemplate: string;   // "%s | Denver Songwriters"
    defaultTitle: string;
    defaultDescription: string;
    keywords: string[];
  };

  // Theme reference
  theme: string;             // References a theme config name

  // Supabase (multi-tenant support)
  database: {
    projectId: string;
    // Could support schema-per-tenant or row-level isolation
    tenantId?: string;
  };
}
```

### 4.2 Example Brand Config

```typescript
// /config/brands/denver-songwriters/index.ts

import { BrandConfig } from '../../brand.types';
import { denverSongwritersTheme } from './theme';

export const denverSongwritersBrand: BrandConfig = {
  id: 'denver-songwriters',
  name: 'Denver Songwriters Collective',
  tagline: 'Connect. Create. Collaborate.',
  description: 'A community platform for Denver-area songwriters...',

  assets: {
    logo: '/brands/denver-songwriters/logo.svg',
    logoAlt: 'Denver Songwriters Collective',
    favicon: '/brands/denver-songwriters/favicon.ico',
    ogImage: '/brands/denver-songwriters/og-image.jpg',
    heroImage: '/brands/denver-songwriters/hero.jpg',
  },

  contact: {
    email: 'hello@denversongwriters.com',
    socialLinks: {
      instagram: 'https://instagram.com/denversongwriters',
      spotify: 'https://open.spotify.com/...',
    },
  },

  features: {
    events: true,
    openMics: true,
    performers: true,
    studios: true,
    blog: true,
    gallery: true,
    tipJar: true,
    spotlight: true,
    map: true,
    comments: true,
    favorites: true,
    rsvp: true,
    studioBooking: true,
  },

  content: {
    navigation: [
      { label: 'Open Mics', href: '/open-mics', enabled: true },
      { label: 'Events', href: '/events', enabled: true },
      { label: 'Members', href: '/members', enabled: true },
      { label: 'Blog', href: '/blog', enabled: true },
      { label: 'Gallery', href: '/gallery', enabled: true },
    ],
    homepage: {
      heroTitle: 'Denver Songwriters Collective',
      heroSubtitle: 'Your home for open mics, collaboration, and community',
      ctaText: 'Find an Open Mic',
      ctaLink: '/open-mics',
      sections: ['highlights', 'events', 'spotlight', 'blog', 'cta'],
    },
    footer: {
      copyright: '© 2024 Denver Songwriters Collective',
      links: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Get Involved', href: '/get-involved' },
      ],
    },
  },

  terminology: {
    event: 'Open Mic',
    eventPlural: 'Open Mics',
    performer: 'Songwriter',
    performerPlural: 'Songwriters',
    host: 'Host',
    hostPlural: 'Hosts',
    member: 'Member',
    memberPlural: 'Members',
  },

  seo: {
    titleTemplate: '%s | Denver Songwriters Collective',
    defaultTitle: 'Denver Songwriters Collective',
    defaultDescription: 'Discover open mics, connect with songwriters...',
    keywords: ['denver', 'songwriters', 'open mic', 'music'],
  },

  theme: 'denver-songwriters',

  database: {
    projectId: 'oipozdbfxyskoscsgbfq',
  },
};

export { denverSongwritersTheme };
```

---

## 5. Mobile App Strategy

### 5.1 Recommended Approach: React Native + Expo

**Why Expo:**
- Managed workflow = faster development
- OTA updates without app store review
- Shared business logic with web
- Good TypeScript support

**Code Sharing Strategy:**

```
/packages
  /core              # Shared business logic (70-80% reuse)
    /hooks           # useAuth, useEvents, useProfile
    /services        # API calls, Supabase client
    /utils           # Formatters, validators
    /types           # TypeScript types
    /config          # Brand & theme configs

  /ui-primitives     # Cross-platform UI primitives
    /Button
    /Card
    /Input
    /Text

/apps
  /web               # Next.js app
    /src
      /components    # Web-specific components
      /app           # Next.js routes

  /mobile            # Expo app
    /src
      /components    # Mobile-specific components
      /screens       # React Navigation screens
```

### 5.2 Theme System for Mobile

```typescript
// /packages/core/config/theme-provider.tsx

import React, { createContext, useContext } from 'react';
import { ThemeConfig } from './theme.types';

const ThemeContext = createContext<ThemeConfig | null>(null);

export const ThemeProvider: React.FC<{
  theme: ThemeConfig;
  children: React.ReactNode;
}> = ({ theme, children }) => {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used within ThemeProvider');
  return theme;
};

// Mobile-specific hook for StyleSheet
export const useStyles = <T extends object>(
  styleFactory: (theme: ThemeConfig) => T
): T => {
  const theme = useTheme();
  return React.useMemo(() => styleFactory(theme), [theme]);
};
```

```typescript
// Mobile component example
// /apps/mobile/src/components/Card.tsx

import { View, StyleSheet } from 'react-native';
import { useStyles, useTheme } from '@core/config/theme-provider';

export const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const styles = useStyles((theme) => StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: parseFloat(theme.borderRadius['2xl']) * 16,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      padding: parseFloat(theme.spacing.lg) * 16,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
    },
  }));

  return <View style={styles.container}>{children}</View>;
};
```

### 5.3 Monorepo Setup

```json
// package.json (root)
{
  "name": "community-platform",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "web": "yarn workspace @apps/web dev",
    "mobile": "yarn workspace @apps/mobile start",
    "build:web": "yarn workspace @apps/web build",
    "build:mobile": "yarn workspace @apps/mobile build"
  }
}
```

---

## 6. Implementation Phases

### Phase 1: Theme System Foundation (Week 1)
**Goal:** Centralize all styling into CSS variables without breaking existing UI

1. **Expand `globals.css`** with complete semantic token system
2. **Create CSS utility classes** that reference variables
3. **Create TypeScript theme types** (`theme.types.ts`)
4. **Create default theme config** (`denver-songwriters.ts`)
5. **Add theme CSS generator** script

**Files to create:**
- `/config/theme.types.ts`
- `/config/brands/denver-songwriters/theme.ts`
- `/config/brands/denver-songwriters/index.ts`
- `/scripts/generate-theme-css.ts`

**Files to modify:**
- `web/src/app/globals.css` (expand variables)

### Phase 2: Component Refactor (Week 2-3)
**Goal:** Replace all hardcoded values with theme references

1. **Audit and list** all components with hardcoded values
2. **Create refactor checklist** by file
3. **Systematically update** each component category:
   - Cards (PerformerCard, EventCard, StudioCard, etc.)
   - Buttons and inputs
   - Navigation (header, footer, mobile menu)
   - Layout components (hero, sections)
   - Typography elements
   - Icons and decorative elements

**Priority order:**
1. Most-used components first
2. Public pages before admin
3. Layout components before content components

### Phase 3: Brand Config System (Week 3-4)
**Goal:** Externalize all brand-specific content

1. **Create brand config types** (`brand.types.ts`)
2. **Extract Denver Songwriters config**
3. **Create BrandProvider** context
4. **Update components** to use brand config
5. **Create example alternate brand**

### Phase 4: Build Tooling (Week 4)
**Goal:** Automated theme/brand switching

1. **Environment-based brand selection**
2. **Build-time CSS generation**
3. **Theme preview tool** (admin feature)
4. **Documentation**

### Phase 5: Mobile Foundation (Week 5-6)
**Goal:** Set up monorepo and shared packages

1. **Restructure to monorepo**
2. **Extract shared code** to `/packages/core`
3. **Set up Expo app**
4. **Implement theme provider** for React Native
5. **Port 2-3 core screens** as proof of concept

### Phase 6: Full Mobile Development (Week 7+)
**Goal:** Feature-complete mobile app

1. Port remaining screens
2. Mobile-specific features (push notifications, etc.)
3. App store preparation

---

## 7. File Structure Changes

### Current Structure
```
/web
  /src
    /app
    /components
    /lib
    /types
```

### Target Structure
```
/packages
  /core
    /config
      /brands
        /denver-songwriters
          theme.ts
          brand.ts
          index.ts
        /light-template
          theme.ts
          brand.ts
          index.ts
      brand.types.ts
      theme.types.ts
      index.ts
    /hooks
    /services
    /types
    /utils

  /ui-primitives
    /Button
    /Card
    /Input
    /Text
    /Avatar
    index.ts

/apps
  /web
    /public
      /brands
        /denver-songwriters
          logo.svg
          og-image.jpg
    /src
      /app
      /components
      /lib
    next.config.ts
    tailwind.config.ts

  /mobile
    /src
      /screens
      /components
      /navigation
    app.json

/scripts
  generate-theme-css.ts

/docs
  THEMING.md
  ADDING_A_BRAND.md
```

---

## 8. Migration Guide

### For Immediate Theme Changes (Current)

Until the full refactor is complete, quick theme changes can be made by editing these files:

1. **`web/src/app/globals.css`** - CSS variables (colors, fonts, shadows)
2. **`web/src/app/layout.tsx`** - Font imports
3. **`web/src/components/layout/hero-section.tsx`** - Hero image
4. **`public/` assets** - Logo, favicon, OG image

### After Phase 2 (Component Refactor)

Theme changes become single-file edits:
1. Edit `/config/brands/denver-songwriters/theme.ts`
2. Run `npm run generate-theme` (or automatic on build)
3. Deploy

### After Phase 3 (Brand Config)

Full brand switch:
1. Create new brand folder `/config/brands/[new-brand]/`
2. Set `NEXT_PUBLIC_BRAND=new-brand` in environment
3. Deploy

---

## 9. Open Questions for Review

### Architecture Questions

1. **Monorepo timing:** Should we restructure to monorepo now or wait until mobile development starts?
   - Pro now: Cleaner separation from start
   - Pro later: Less disruption, faster immediate progress

2. **Multi-tenancy approach:** For true white-label with separate databases:
   - Separate Supabase projects per brand?
   - Single project with schema-per-tenant?
   - Single project with row-level tenant isolation?

3. **Build vs Runtime theming:**
   - Build-time: Faster, smaller bundle, but requires rebuild to switch
   - Runtime: Slower initial load, but supports user-selected themes
   - Recommendation: Build-time for brand theming, runtime for dark/light mode

### Implementation Questions

4. **Tailwind v4 approach:**
   - Use `@theme` directive (current)?
   - Use CSS custom properties directly?
   - Hybrid approach?

5. **Component library:** Should we adopt a headless UI library (Radix, Headless UI) as base?
   - Pro: Accessibility, consistent behavior
   - Con: Learning curve, potential conflicts

6. **CSS-in-JS for mobile:**
   - React Native StyleSheet (recommended)?
   - Styled-components/Emotion?
   - Tamagui (cross-platform)?

### Scope Questions

7. **Phase 1 scope:** Should Phase 1 include the visual redesign to "light, uplifting" colors, or focus purely on infrastructure?

8. **Testing:** What level of visual regression testing is desired?

9. **Documentation:** Should we create Storybook for component documentation?

---

## Appendix: Quick Reference

### CSS Variable Naming Convention

```
--theme-[category]-[variant]

Categories: bg, text, border, accent, shadow, gradient
Variants: primary, secondary, tertiary, muted, inverse, hover, focus, active

Examples:
--theme-bg-primary
--theme-text-secondary
--theme-border-accent
--theme-accent-primary-hover
```

### Component Class Naming Convention

```
.[component]-[element]--[modifier]

Examples:
.card-base
.card-header
.card-body--padded
.btn-primary
.btn-primary--large
```

### Environment Variables

```bash
# Brand selection
NEXT_PUBLIC_BRAND=denver-songwriters

# Feature flags (override brand defaults)
NEXT_PUBLIC_FEATURE_STUDIO_BOOKING=true

# Theme override (for preview/testing)
NEXT_PUBLIC_THEME_OVERRIDE=light-warm
```

---

**Document Status:** Ready for expert review
**Next Steps:** Gather feedback, refine plan, begin Phase 1 implementation
