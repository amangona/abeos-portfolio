/* ============================================================================
 * scripts/data.example.js — TEMPLATE
 *
 * Copy this file to scripts/data.js and fill it in with your own details:
 *     cp scripts/data.example.js scripts/data.js
 *
 * index.html loads scripts/data.js (which is gitignored so your personal
 * content never ends up in the repo). Everything the site shows comes from
 * the single window.ABE_DATA object below — edit the text, add experience,
 * projects, skills, and tweak the chat flow. No build step.
 * ==========================================================================*/

window.ABE_DATA = {

  /* ---- Identity -------------------------------------------------------- */
  identity: {
    name: 'Your Name',
    title: 'Product engineer — I build & ship things',
    location: 'Your City',
    blurb:
      'A one-or-two sentence hook about who you are and what you do. ' +
      'Confident, a little playful — this is the vibe of the whole site.',
    avatar: 'assets/avatar.png'   // optional; not shown by default
  },

  /* ---- Links ----------------------------------------------------------- */
  links: {
    email: 'you@example.com',
    linkedin: 'https://www.linkedin.com/in/your-handle/',
    github: 'https://github.com/your-handle',
    resume: 'resume.pdf'          // drop your own resume.pdf in the project root
  },

  /* ---- Experience (newest first) --------------------------------------
   * featured:true highlights a role (coral accent + "featured" badge).
   * --------------------------------------------------------------------- */
  experience: [
    {
      company: 'Example Studio',
      role: 'Co-Founder & Engineer',
      team: 'Founder',
      dates: 'Jan 2024 – Present',
      location: 'Your City',
      featured: true,
      summary: 'One line on the role and the outcome you owned.',
      highlights: [
        'A concrete, results-flavored bullet about something you shipped.',
        'Another bullet — keep them punchy and specific.',
        'A third highlight; 3–5 per role reads well.'
      ],
      tags: ['Skill', 'Tool', 'Framework']
    },
    {
      company: 'Bigco',
      role: 'Software Engineer',
      team: 'Some Team',
      dates: 'Mar 2021 – Dec 2023',
      location: 'Remote',
      featured: true,
      summary: 'What you did here, in one sentence.',
      highlights: [
        'Shipped X that did Y.',
        'Partnered with Design & Product on Z.'
      ],
      tags: ['Skill', 'Tool']
    },
    {
      company: 'First Job Inc.',
      role: 'Junior Engineer',
      team: 'Mobile',
      dates: 'Jun 2019 – Feb 2021',
      location: 'Your City',
      featured: false,
      summary: 'Earlier role — still worth a line.',
      highlights: [
        'Built features in the thing.',
        'Wrote tests and set up CI.'
      ],
      tags: ['Skill', 'Tool']
    }
  ],

  /* ---- Skills (group them; levels are 0–100) --------------------------- */
  skills: [
    {
      group: 'Build',
      items: [
        { name: 'JavaScript', level: 85 },
        { name: 'Python', level: 80 },
        { name: 'APIs / REST', level: 85 },
        { name: 'SQL', level: 70 }
      ]
    },
    {
      group: 'Craft',
      items: [
        { name: 'Product sense', level: 88 },
        { name: 'UI / UX', level: 80 },
        { name: 'Shipping fast', level: 92 }
      ]
    },
    {
      group: 'Applied AI',
      items: [
        { name: 'LLM tooling', level: 78 },
        { name: 'Automation', level: 80 }
      ]
    }
  ],

  /* ---- Projects -------------------------------------------------------
   * Optional: `icon` (path to a square image), `appStore` and `github` URLs.
   * Link buttons only appear when the URL is present.
   * --------------------------------------------------------------------- */
  projects: [
    {
      emoji: '🚀',
      // icon: 'assets/icons/project-one.png',
      name: 'Project One',
      blurb: 'One line describing what it is and why it’s cool.',
      tags: ['Tag', 'Tag'],
      appStore: null,   // e.g. 'https://apps.apple.com/...'
      github: null      // e.g. 'https://github.com/you/project-one'
    },
    {
      emoji: '🧩',
      name: 'Project Two',
      blurb: 'Another short, punchy description.',
      tags: ['Tag'],
      appStore: null,
      github: null
    }
  ],

  /* ---- About ----------------------------------------------------------- */
  about: {
    bio: [
      'First paragraph — who you are and what you care about, in your voice.',
      'Second paragraph — your path / what you’re into lately.'
    ],
    funFacts: [
      'A fun, human line about you.',
      'Another one — these add personality.',
      'A third (3–4 reads nicely).'
    ]
  },

  /* ====================================================================== *
   * Chat flow — the scripted "bot". start = "root".
   * Each node: messages[] (bot bubbles), optional replies[] (quick-reply
   * chips) and links[] (anchor buttons). Reply shapes:
   *   { label, goto: 'nodeId' }                      -> advance to a node
   *   { label, action: { openWindow: 'projects' } }  -> open a window
   *   { label, action: { ai: true } }                -> start the live-AI mode
   *   { label, link: 'mailto:...' }                  -> open a link
   * Every non-root node should offer a way back to "root" so it never dead-ends.
   * ==================================================================== */
  chat: {
    start: 'root',
    nodes: {

      root: {
        messages: [
          'Hey! I’m the bot 👋',
          'I’m here to introduce you to {Your Name}.',
          'What do you want to dig into?'
        ],
        replies: [
          { label: 'Who are you?', goto: 'who' },
          { label: 'Best work?', goto: 'best' },
          { label: 'See projects ▸', goto: 'projects', action: { openWindow: 'projects' } },
          { label: '📄 Résumé', action: { openWindow: 'resume' } },
          { label: '🧠 Ask me anything (live AI)', action: { ai: true } },
          { label: 'Get in touch ▸', goto: 'contact' }
        ]
      },

      who: {
        messages: [
          'A short, friendly intro paragraph as the bot, summarizing who you are.',
          'Keep it to a couple of sentences.'
        ],
        replies: [
          { label: 'Best work?', goto: 'best' },
          { label: '↩ back to start', goto: 'root' }
        ]
      },

      best: {
        messages: [
          'Highlights:',
          'A sentence or two about your standout work.'
        ],
        replies: [
          { label: 'See projects ▸', goto: 'projects', action: { openWindow: 'projects' } },
          { label: '↩ back to start', goto: 'root' }
        ]
      },

      projects: {
        messages: [
          'Opened the projects window for you 👉',
          'A line tying your projects together.'
        ],
        replies: [
          { label: 'Get in touch ▸', goto: 'contact' },
          { label: '↩ back to start', goto: 'root' }
        ]
      },

      contact: {
        messages: [
          'Let’s talk!',
          'Easiest paths:'
        ],
        links: [
          { label: '✉ Email', href: 'mailto:you@example.com' },
          { label: 'in LinkedIn', href: 'https://www.linkedin.com/in/your-handle/' }
        ],
        replies: [
          { label: '📄 Grab the résumé', action: { openWindow: 'resume' } },
          { label: '↩ back to start', goto: 'root' }
        ]
      }

    }
  }

};
