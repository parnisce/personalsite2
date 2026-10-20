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
import { TbBolt, TbBrandOpenai, TbCode, TbHierarchy3, TbMessageChatbot, TbPalette, TbRoute } from 'react-icons/tb'

export const NAV = [
  { id: 'hero', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'portfolio', label: 'Work' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'stack', label: 'Services' },
  { id: 'contact', label: 'Contact' },
  { id: 'tools', label: 'Free Tools', href: '/tools/' },
]

export const BOOKING_URL = 'https://go.cyrusbitangcol.com/book-a-call'
export const LINKEDIN_RECOMMENDATIONS_URL =
  'https://www.linkedin.com/in/cyrus-bitangcol/details/recommendations/?detailScreenTabIndex=0'

export const STATS = [
  { value: 17, suffix: '+', label: 'Years building the web' },
  { value: 2, suffix: '+', label: 'Years shipping Next.js & GoHighLevel' },
  { value: 24, suffix: '/7', label: 'Lead follow-up with Conversation AI' },
]

// Swap `image` in for a real screenshot when you have one (e.g. '/projects/adlington.jpg' in /public).
export const PROJECTS = [
  {
    title: 'Adlington Homes',
    domain: 'adlingtonhomes.com',
    url: 'https://adlingtonhomes.com/',
    tags: ['Next.js', 'GoHighLevel CRM', 'AI Workflows'],
    description:
      'A custom Next.js site for a 50-year Illawarra home builder. Clear service paths and project galleries feed a GoHighLevel consultation funnel, with AI workflows following up every enquiry.',
    hue: 190,
  },
  {
    title: 'Diack Homes',
    domain: 'diackhomes.co.nz',
    url: 'https://diackhomes.co.nz/',
    tags: ['Next.js', 'Multi-region', 'GoHighLevel CRM'],
    description:
      'One brand, two regions. A Next.js entry page routes Bay of Plenty and Christchurch visitors to their local site, and every lead lands in the right regional pipeline.',
    hue: 160,
  },
  {
    title: 'Gray Brothers Builders',
    domain: 'graybro.co.nz',
    url: 'https://graybro.co.nz/',
    tags: ['Next.js', 'Online Estimate', 'AI Follow-up'],
    description:
      'An award-winning Dunedin builder. A Next.js online estimate tool qualifies leads before the first call, and GoHighLevel automations take it from there.',
    hue: 30,
  },
]

// LinkedIn recommendations, quoted word for word.
export const TESTIMONIALS = [
  {
    quote:
      "Cyrus is a great website designer and developer. He's also very skilled in working with CRMs and complex workflows. If you are looking for a talented and reliable member of your marketing team, I would highly recommend Cyrus.",
    name: 'Roger Valdez',
    role: 'Founder & CEO, Top Result Consulting',
  },
  {
    quote:
      'I have worked with Cyrus for many years. He has assisted me long distance to achieve many wonderful outcomes for my online presentations, from website updates and plugins to layout and copy updates. He is always willing to help and is pleasant to work with.',
    name: 'Jacqueline Coates',
    role: 'Internationally Acclaimed Artist',
  },
  {
    quote: 'Worked with Cyrus, came through when we needed it the most. Great knowledge and punctual. Recommended A+!!',
    name: 'Bilal Asad',
    role: 'Founder, ScaleYourBiz',
  },
  {
    quote:
      'Cyrus worked with me to build my first membership site. My build was more complicated than the usual template and he worked consistently with me to get the design right and working effectively. He takes the time to understand what you want and how to implement it.',
    name: 'Robyn Barraclough',
    role: 'Body Harmony Teacher',
  },
  {
    quote:
      'What I appreciate about his work ethic is his promptness and punctuality in his deliverables. He is committed to target dates and always keeps an open mind to client requests. Cyrus is my go-to guy for anything web development and digital marketing.',
    name: 'Norman Velasco',
    role: 'CEO/Owner, EnvieMyMan',
  },
  {
    quote:
      'Cyrus changed the overall look and feel of our live surfboard website using the same WP template. He listens carefully, is really organized, and his Photoshop skills meant he handled all the image work too. A really nice and easy person to work with!',
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

// Contact form delivery. Fill in ONE of these and messages go straight to your inbox:
//  - FORM_ACCESS_KEY: the free access key from https://web3forms.com (the simplest option)
//  - FORM_ENDPOINT:   a form URL from another service, e.g. Formspree's https://formspree.io/f/xxxx
// While both are empty, the form opens the visitor's email app with the message ready to send.
export const FORM_ACCESS_KEY = ''
export const FORM_ENDPOINT = ''

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
