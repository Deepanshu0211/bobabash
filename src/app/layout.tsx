import type {Metadata, Viewport} from 'next';
import {Baloo_2, JetBrains_Mono, Poppins} from 'next/font/google';
import {MotionProvider} from '@/components/motion';
import {Toaster} from '@/components/form';
import {SITE, siteUrl} from '@/lib/site';
import './globals.css';
import './portal.css';

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {default: `${SITE.name} · ${SITE.tagline}`, template: `%s · ${SITE.shortName}`},
  description: SITE.description,
  applicationName: SITE.shortName,
  keywords: SITE.keywords,
  authors: [{name: 'Hack Club Lucknow crew'}],
  creator: 'Hack Club Lucknow crew',
  category: 'event',
  alternates: {canonical: '/'},
  openGraph: {type: 'website', siteName: SITE.name, title: SITE.name, description: SITE.description, locale: SITE.locale, url: '/'},
  twitter: {card: 'summary_large_image', title: SITE.name, description: SITE.description},
  robots: {index: true, follow: true},
  formatDetection: {telephone: false, email: false, address: false}
};
export const viewport: Viewport = {themeColor: '#c5e8f4', width: 'device-width', initialScale: 1};
export const dynamic = 'force-dynamic';

// Brand fonts from the Boba Bash branding guide, self-hosted by next/font at build time.
const baloo = Baloo_2({subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-baloo', display: 'swap'});
const poppins = Poppins({subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-poppins', display: 'swap'});
const mono = JetBrains_Mono({subsets: ['latin'], weight: ['400', '700'], variable: '--font-jetbrains', display: 'swap'});

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${baloo.variable} ${poppins.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
        <MotionProvider/>
        <Toaster/>
      </body>
    </html>
  );
}
