/**
 * GET /api/og — Dynamic Open Graph image generator.
 *
 * Generates RPG-styled preview cards for social sharing.
 * Query params:
 *   ?title=facebook/react&stars=243k&lang=JavaScript&desc=The+library+for+web+and+native+user+interfaces
 *   ?title=TypeScript+Kingdom&repos=131&top=vuejs/vue
 *   (no params) → homepage card
 */
import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url, 'https://gitkingdom.com');

  const title = searchParams.get('title') || 'Git Kingdom';
  const subtitle = searchParams.get('subtitle') || '';
  const stars = searchParams.get('stars') || '';
  const lang = searchParams.get('lang') || '';
  const desc = searchParams.get('desc') || '';

  const isHomepage = !searchParams.get('title');

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
          fontFamily: 'monospace',
          padding: '40px 60px',
        },
        children: [
          // Top border accent
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: 'linear-gradient(90deg, #8b6914, #ffd700, #8b6914)',
              },
            },
          },
          // Bottom border accent
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: 'linear-gradient(90deg, #8b6914, #ffd700, #8b6914)',
              },
            },
          },
          // Site name
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: isHomepage ? '20px' : '12px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: isHomepage ? '52px' : '28px',
                      color: '#ffd700',
                      fontWeight: 'bold',
                      letterSpacing: '4px',
                      textShadow: '0 0 20px rgba(255,215,0,0.4)',
                    },
                    children: isHomepage ? 'GIT KINGDOM' : 'GIT KINGDOM',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '14px',
                      color: '#1a1a2e',
                      background: '#ffd700',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      letterSpacing: '2px',
                    },
                    children: 'ALPHA',
                  },
                },
              ],
            },
          },
          // Main title (repo name, kingdom name, or tagline)
          isHomepage
            ? {
                type: 'div',
                props: {
                  style: {
                    fontSize: '22px',
                    color: '#a89060',
                    textAlign: 'center' as const,
                    marginBottom: '24px',
                    letterSpacing: '1px',
                  },
                  children: 'Explore GitHub as a Fantasy RPG World',
                },
              }
            : {
                type: 'div',
                props: {
                  style: {
                    fontSize: '42px',
                    color: '#e0d0a0',
                    fontWeight: 'bold',
                    textAlign: 'center' as const,
                    marginBottom: '16px',
                    maxWidth: '900px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                  children: title,
                },
              },
          // Stats row (stars, language, etc.)
          (stars || lang) && !isHomepage
            ? {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '24px',
                    marginBottom: '16px',
                  },
                  children: [
                    stars
                      ? {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: '24px',
                              color: '#e8a020',
                            },
                            children: `★ ${stars} stars`,
                          },
                        }
                      : null,
                    lang
                      ? {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: '20px',
                              color: '#c8a853',
                              background: 'rgba(200,168,83,0.15)',
                              padding: '6px 16px',
                              borderRadius: '6px',
                              border: '2px solid #5a3a1a',
                            },
                            children: `${lang} Kingdom`,
                          },
                        }
                      : null,
                  ].filter(Boolean),
                },
              }
            : null,
          // Description or subtitle
          (desc || subtitle)
            ? {
                type: 'div',
                props: {
                  style: {
                    fontSize: '18px',
                    color: '#8a8070',
                    textAlign: 'center' as const,
                    maxWidth: '800px',
                    lineHeight: '1.5',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                  children: desc || subtitle,
                },
              }
            : null,
          // Homepage features
          isHomepage
            ? {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    gap: '32px',
                    marginTop: '8px',
                  },
                  children: [
                    { icon: '🏰', text: 'Repos as buildings' },
                    { icon: '👥', text: 'Contributors as citizens' },
                    { icon: '⚔', text: 'Languages as kingdoms' },
                  ].map((item) => ({
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '18px',
                        color: '#b0a070',
                      },
                      children: [
                        {
                          type: 'span',
                          props: {
                            style: { fontSize: '24px' },
                            children: item.icon,
                          },
                        },
                        {
                          type: 'span',
                          props: {
                            children: item.text,
                          },
                        },
                      ],
                    },
                  })),
                },
              }
            : null,
          // URL at bottom
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: '20px',
                right: '40px',
                fontSize: '16px',
                color: '#5a4a2a',
                letterSpacing: '1px',
              },
              children: 'gitkingdom.com',
            },
          },
        ].filter(Boolean),
      },
    },
    {
      width: 1200,
      height: 630,
    },
  );
}
