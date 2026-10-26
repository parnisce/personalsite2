// Site content, taken from cyrusbitangcol.com (the name shown on this site is Cyryl).
import { FaFacebookF, FaInstagram, FaLinkedinIn } from 'react-icons/fa6'
import {
  SiClaude,
  SiCursor,
  SiElementor,
  SiFigma,
  SiGreensock,
  SiNextdotjs,
  SiReact,
  SiSupabase,
  SiTailwindcss,
  SiThreedotjs,
  SiTypescript,
  SiWordpress,
} from 'react-icons/si'
import {
  TbBolt,
  TbBrandOpenai,
  TbCode,
  TbGitFork,
  TbHierarchy3,
  TbMessageChatbot,
  TbPalette,
  TbRoute,
  TbStack2,
  TbTag,
} from 'react-icons/tb'

export const NAV = [
  { id: 'hero', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'portfolio', label: 'Work' },
  { id: 'journey', label: 'Journey' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'stack', label: 'Services' },
  { id: 'contact', label: 'Contact' },
  { id: 'resources', label: 'Resources', href: '/resources/' },
]

export const BOOKING_URL = 'https://go.cyrusbitangcol.com/book-a-call'
export const LINKEDIN_RECOMMENDATIONS_URL =
  'https://www.linkedin.com/in/cyrus-bitangcol/details/recommendations/?detailScreenTabIndex=0'

export const STATS = [
  { value: 17, suffix: '+', label: 'Years building the web' },
  { value: 2, suffix: '+', label: 'Years shipping Next.js & GoHighLevel' },
  { value: 24, suffix: '/7', label: 'Lead follow-up with Conversation AI' },
]

// Each project can have `image` (website view) and `mobileImage` (phone view): files in public/projects.
export const PROJECTS = [
  {
    title: 'SonicRing',
    domain: 'sonicring.com',
    url: 'https://sonicring.com/',
    tags: ['AI Workforce', 'Voice & SMS', 'Lead Follow-up'],
    description:
      'A full team of AI employees for your business. Every call answered, every lead followed up, every appointment booked.',
    hue: 265,
    image: '/projects/sonicring-desktop.webp',
    mobileImage: '/projects/sonicring-mobile.webp',
  },
  {
    title: 'Autophagy FastTrack',
    domain: 'autophagytools.com',
    url: 'https://autophagytools.com/',
    tags: ['Mobile App', 'Fasting Tracker', 'Landing Page'],
    description:
      'A science-backed fasting tracker and autophagy calculator. It shows when autophagy starts in your body, with timelines and schedules personalised to you.',
    hue: 320,
    image: '/projects/autophagy-desktop.webp',
    mobileImage: '/projects/autophagy-mobile.webp',
  },
  {
    title: 'Prisma Digital',
    domain: 'prismadig.com',
    url: 'https://prismadig.com/',
    tags: ['Software Development', 'Full-stack', 'Digital Transformation'],
    description:
      'Software development and digital transformation made easy. Customised full-stack software services, tailored to what the business actually needs.',
    hue: 215,
    image: '/projects/prisma-desktop.webp',
    mobileImage: '/projects/prisma-mobile.webp',
  },
  {
    title: 'TalentPro PH',
    domain: 'talentproph.pages.dev',
    url: 'https://talentproph.pages.dev/',
    tags: ['Remote Hiring', 'AI Matching', 'Job Platform'],
    description:
      'A premium remote jobs platform. Discover top remote professionals, get AI-powered recommendations and build your dream team effortlessly.',
    hue: 205,
    image: '/projects/talentpro-desktop.webp',
    mobileImage: '/projects/talentpro-mobile.webp',
  },
]

// LinkedIn recommendations, quoted word for word.
export const TESTIMONIALS = [
  {
    quote:
      "Cyryl is a great website designer and developer. He's also very skilled in working with CRMs and complex workflows. If you are looking for a talented and reliable member of your marketing team, I would highly recommend Cyryl.",
    name: 'Roger Valdez',
    role: 'Founder & CEO, Top Result Consulting',
  },
  {
    quote:
      'I have worked with Cyryl for many years. He has assisted me long distance to achieve many wonderful outcomes for my online presentations, from website updates and plugins to layout and copy updates. He is always willing to help and is pleasant to work with.',
    name: 'Jacqueline Coates',
    role: 'Internationally Acclaimed Artist',
  },
  {
    quote: 'Worked with Cyryl, came through when we needed it the most. Great knowledge and punctual. Recommended A+!!',
    name: 'Bilal Asad',
    role: 'Founder, ScaleYourBiz',
  },
  {
    quote:
      'Cyryl worked with me to build my first membership site. My build was more complicated than the usual template and he worked consistently with me to get the design right and working effectively. He takes the time to understand what you want and how to implement it.',
    name: 'Robyn Barraclough',
    role: 'Body Harmony Teacher',
  },
  {
    quote:
      'What I appreciate about his work ethic is his promptness and punctuality in his deliverables. He is committed to target dates and always keeps an open mind to client requests. Cyryl is my go-to guy for anything web development and digital marketing.',
    name: 'Norman Velasco',
    role: 'CEO/Owner, EnvieMyMan',
  },
  {
    quote:
      'Cyryl changed the overall look and feel of our live surfboard website using the same WP template. He listens carefully, is really organized, and his Photoshop skills meant he handled all the image work too. A really nice and easy person to work with!',
    name: 'Julien Bailly',
    role: 'Founder & Director, Una Bambu',
  },
]

export const SERVICES = [
  {
    title: 'Next.js Website Development',
    tagline: 'A website that loads fast and ranks.',
    description:
      'Custom Next.js sites with Supabase behind them. Fast, secure and easy to grow, with no plugins to update and nothing to break overnight.',
    Icon: TbCode,
  },
  {
    title: 'GoHighLevel Funnels & CRM',
    tagline: 'Every lead lands exactly where it should.',
    description:
      'GoHighLevel funnels, pipelines and calendars, with your website wired straight into them so no one slips through the cracks.',
    Icon: TbRoute,
  },
  {
    title: 'Workflows & Automation',
    tagline: 'Follow-up that runs while you sleep.',
    description:
      'Workflows that follow up, tag, remind and re-engage leads automatically. No more copy-pasting enquiries or forgetting to call back.',
    Icon: TbBolt,
  },
  {
    title: 'Conversation AI',
    tagline: 'An assistant that replies in seconds, 24/7.',
    description:
      'GoHighLevel Conversation AI trained on your business, so it answers questions, qualifies leads and books calls, day and night.',
    Icon: TbMessageChatbot,
  },
  {
    title: 'Brand & Web Design',
    tagline: 'A brand people remember.',
    description:
      'Brand, layout and page visuals designed by the same hands that build the site, so the look and the build never clash.',
    Icon: TbPalette,
  },
]

export const STACK = [
  { name: 'Next.js', Icon: SiNextdotjs, color: '#ffffff' },
  { name: 'React', Icon: SiReact, color: '#61dafb' },
  { name: 'TypeScript', Icon: SiTypescript, color: '#3178c6' },
  { name: 'Tailwind CSS', Icon: SiTailwindcss, color: '#38bdf8' },
  { name: 'Supabase', Icon: SiSupabase, color: '#3ecf8e' },
  { name: 'GoHighLevel', Icon: TbHierarchy3, color: '#00e5ff' },
  { name: 'Conversation AI', Icon: TbMessageChatbot, color: '#00c7d9' },
  { name: 'Figma', Icon: SiFigma, color: '#f24e1e' },
  { name: 'Claude Code', Icon: SiClaude, color: '#d97757' },
  { name: 'Codex', Icon: TbBrandOpenai, color: '#ffffff' },
  { name: 'Cursor', Icon: SiCursor, color: '#ffffff' },
  { name: 'Three.js', Icon: SiThreedotjs, color: '#ffffff' },
  { name: 'GSAP', Icon: SiGreensock, color: '#88ce02' },
  { name: 'WordPress', Icon: SiWordpress, color: '#ffffff' },
  { name: 'Elementor', Icon: SiElementor, color: '#d63c88' },
  { name: 'FunnelKit', Icon: TbBolt, color: '#7c6cff' },
]


export const CONTACT = {
  email: 'cyrylbitangcol@gmail.com',
  location: 'Based in the Philippines',
  reach: 'Working with clients worldwide',
  socials: [
    { label: 'Facebook', Icon: FaFacebookF, href: 'https://www.facebook.com/CyrusBitangcolOfficial' },
    { label: 'LinkedIn', Icon: FaLinkedinIn, href: 'https://www.linkedin.com/in/cyrus-bitangcol/' },
    { label: 'Instagram', Icon: FaInstagram, href: 'https://www.instagram.com/iamcyrusbitangcol/' },
  ],
}

// About section: the three link underlines and the three pillars under the intro.
export const ABOUT_LINKS = [
  { label: 'GitHub', href: 'https://github.com/parnisce' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/cyrus-bitangcol/' },
  { label: 'Portfolio', href: '#portfolio', internal: true },
]

export const ABOUT_PILLARS = [
  {
    title: 'Web Development',
    description: 'Fast, responsive websites and custom applications built with Next.js, React, and modern backend technologies.',
    Icon: TbStack2,
  },
  {
    title: 'AI & Automation',
    description: 'Connected workflows, automated follow-ups, and AI-powered conversations that help businesses respond faster.',
    Icon: TbGitFork,
  },
  {
    title: 'UI & Product Design',
    description: 'Thoughtful interfaces, intuitive user journeys, and cohesive design systems built around user needs.',
    Icon: TbTag,
  },
]

// Journey timeline, newest first. `big` is what the large year on the left shows when the item is in view.
export const JOURNEY = [
  {
    year: 'Present',
    big: 'Now',
    title: 'Systems that deliver',
    text: 'Combining modern web development, interface design and intelligent automation to build fast, custom experiences that turn more visitors into customers.',
    tags: ['AI', 'Next.js', 'Growth'],
  },
  {
    year: '2025',
    title: 'Automation and AI',
    text: 'Added workflows and Conversation AI so every lead gets a reply in seconds, around the clock, without anyone copying and pasting.',
    tags: ['Workflows', 'Conversation AI', 'Automation'],
  },
  {
    year: '2024',
    title: 'Next.js and Supabase',
    text: 'Moved to custom builds on Next.js with Supabase, paired with GoHighLevel for funnels, pipelines and calendars.',
    tags: ['Next.js', 'Supabase', 'GoHighLevel'],
  },
  {
    year: '2010s',
    title: 'WordPress for agencies',
    text: 'For over a decade I built WordPress sites for agencies, consultancies and founders. It taught me what clients actually need: a site that looks right and brings in work.',
    tags: ['WordPress', 'Elementor', 'Agencies'],
  },
  {
    year: '2009',
    title: 'The first website',
    text: 'Started building websites and found out I enjoyed the craft as much as the result. The start of seventeen years on the web.',
    tags: ['HTML', 'CSS', 'Web'],
  },
]
