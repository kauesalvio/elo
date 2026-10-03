import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://rapaziadahora.online'),
  title: 'rapaziadahora · Dá o play na sala',
  description:
    'Compartilhe sua tela com a rapaziada em salas privadas. Um espaço retrô, com criptografia de ponta a ponta.',
  openGraph: {
    title: 'rapaziadahora · Dá o play na sala',
    description:
      'Compartilhe sua tela com a rapaziada em salas privadas. Um espaço retrô, com criptografia de ponta a ponta.',
    siteName: 'rapaziadahora',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: '/share-card.png',
        width: 1734,
        height: 907,
        alt: 'Shiba em pixel art apresenta o rapaziadahora: dá o play na sala.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'rapaziadahora · Dá o play na sala',
    description:
      'Compartilhe sua tela com a rapaziada em salas privadas. Um espaço retrô, com criptografia de ponta a ponta.',
    images: ['/share-card.png'],
  },
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
