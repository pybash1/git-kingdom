/**
 * GET /api/citizen-og?username={username}
 * Generates a custom 1200×630 RPG character card image for social sharing.
 * Uses @vercel/og to render the card at the edge.
 */
import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

interface CitizenData {
  login: string;
  avatar_url: string;
  totalContributions: number;
  level: number;
  xp: number;
  title: { icon: string; name: string; kingdom: string };
  stats: { power: number; reach: number; versatility: number };
  badges: { id: string; icon: string; label: string }[];
  languages: string[];
  repos: { full_name: string; stargazers: number; contributions: number }[];
}

function statBar(label: string, icon: string, value: number) {
  const pct = (value / 20) * 100;
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '6px',
      },
      children: [
        // Icon + label
        {
          type: 'div',
          props: {
            style: {
              width: '130px',
              fontSize: '16px',
              color: '#c8b87c',
              letterSpacing: '1.5px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            },
            children: `${icon} ${label}`,
          },
        },
        // Bar background
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              height: '18px',
              background: 'rgba(50,40,20,0.6)',
              borderRadius: '3px',
              border: '1px solid #5a4a2a',
              display: 'flex',
              overflow: 'hidden',
            },
            children: [
              // Bar fill
              {
                type: 'div',
                props: {
                  style: {
                    width: `${pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #8b6914, #d4a520, #ffd700)',
                    borderRadius: '2px',
                  },
                },
              },
            ],
          },
        },
        // Value text
        {
          type: 'div',
          props: {
            style: {
              width: '50px',
              textAlign: 'right' as const,
              fontSize: '15px',
              color: '#a89060',
            },
            children: `${value}/20`,
          },
        },
      ],
    },
  };
}

function buildCard(d: CitizenData) {
  const badgeStr = d.badges.map((b) => b.icon).join('  ');
  const langStr = d.languages.slice(0, 5).join(' · ');

  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #1a1508 100%)',
        fontFamily: 'monospace',
        padding: '0',
        position: 'relative',
      },
      children: [
        // Top gold border
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
        // Bottom gold border
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
        // Main content area
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flex: 1,
              padding: '40px 50px',
              gap: '40px',
            },
            children: [
              // Left column — avatar
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    paddingTop: '10px',
                  },
                  children: [
                    // Avatar with gold border
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: '160px',
                          height: '160px',
                          borderRadius: '12px',
                          border: '4px solid #d4a520',
                          boxShadow: '0 0 20px rgba(212,165,32,0.3)',
                          overflow: 'hidden',
                          display: 'flex',
                        },
                        children: [
                          {
                            type: 'img',
                            props: {
                              src: d.avatar_url || `https://github.com/${d.login}.png?size=200`,
                              width: 160,
                              height: 160,
                              style: {
                                objectFit: 'cover',
                              },
                            },
                          },
                        ],
                      },
                    },
                    // Level badge under avatar
                    {
                      type: 'div',
                      props: {
                        style: {
                          marginTop: '14px',
                          background: 'rgba(212,165,32,0.15)',
                          border: '2px solid #8b6914',
                          borderRadius: '8px',
                          padding: '6px 20px',
                          fontSize: '16px',
                          color: '#d4a520',
                          fontWeight: 'bold',
                          letterSpacing: '1px',
                        },
                        children: `LVL ${d.level}`,
                      },
                    },
                  ],
                },
              },
              // Right column — info + stats
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    justifyContent: 'flex-start',
                    paddingTop: '6px',
                  },
                  children: [
                    // Username
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '38px',
                          color: '#f0e8cc',
                          fontWeight: 'bold',
                          letterSpacing: '1px',
                          marginBottom: '4px',
                        },
                        children: `@${d.login}`,
                      },
                    },
                    // Title + Kingdom
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '22px',
                          color: '#c8b060',
                          marginBottom: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        },
                        children: `${d.title.icon} ${d.title.name} of ${d.title.kingdom}`,
                      },
                    },
                    // XP
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '15px',
                          color: '#8a7a58',
                          marginBottom: '24px',
                        },
                        children: `${d.xp.toLocaleString()} XP · ${d.totalContributions.toLocaleString()} contributions · ${d.repos.length} repos`,
                      },
                    },
                    // Stat bars
                    statBar('POWER', '⚔', d.stats.power),
                    statBar('REACH', '⭐', d.stats.reach),
                    statBar('VERSATILITY', '🌐', d.stats.versatility),
                    // Spacer
                    {
                      type: 'div',
                      props: {
                        style: { flex: 1, minHeight: '16px' },
                      },
                    },
                    // Bottom row — badges + languages
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-end',
                        },
                        children: [
                          // Badges
                          badgeStr
                            ? {
                                type: 'div',
                                props: {
                                  style: {
                                    fontSize: '26px',
                                    letterSpacing: '4px',
                                  },
                                  children: badgeStr,
                                },
                              }
                            : null,
                          // Languages
                          langStr
                            ? {
                                type: 'div',
                                props: {
                                  style: {
                                    fontSize: '14px',
                                    color: '#8a7a58',
                                    textAlign: 'right' as const,
                                  },
                                  children: langStr,
                                },
                              }
                            : null,
                        ].filter(Boolean),
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        // Branding row — top right
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: '24px',
              right: '50px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '20px',
                    color: '#ffd700',
                    fontWeight: 'bold',
                    letterSpacing: '3px',
                    textShadow: '0 0 16px rgba(255,215,0,0.3)',
                  },
                  children: 'GIT KINGDOM',
                },
              },
            ],
          },
        },
        // URL bottom right
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: '18px',
              right: '50px',
              fontSize: '14px',
              color: '#5a4a2a',
              letterSpacing: '1px',
            },
            children: 'gitkingdom.com',
          },
        },
      ].filter(Boolean),
    },
  };
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url, 'https://gitkingdom.com');
  const username = searchParams.get('username');

  if (!username) {
    return new Response('Missing username', { status: 400 });
  }

  try {
    // Fetch citizen data from our own API
    const host = req.headers.get('host') || 'www.gitkingdom.com';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const apiUrl = `${protocol}://${host}/api/citizen?username=${encodeURIComponent(username)}`;
    const res = await fetch(apiUrl);

    if (!res.ok) {
      // Fallback: simple text card for unknown users
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
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { fontSize: '32px', color: '#ffd700', fontWeight: 'bold', letterSpacing: '4px' },
                  children: 'GIT KINGDOM',
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '24px', color: '#8a7a58', marginTop: '16px' },
                  children: `Citizen not found: ${username}`,
                },
              },
            ],
          },
        },
        { width: 1200, height: 630 },
      );
    }

    const data: CitizenData = await res.json();

    return new ImageResponse(buildCard(data), {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    return new Response(`Failed to generate image: ${err}`, { status: 500 });
  }
}
