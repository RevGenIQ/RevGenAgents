import type { Metadata } from "next";
import { plusJakarta, geistSans, geistMono } from "@/app/fonts";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeToggle";
import { AuthProvider } from "@/context/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { IntroSplash } from "@/components/ui/IntroSplash";

export const metadata: Metadata = {
  title: "RevGen AI — AI Revenue Operating System",
  description:
    "A verified pipeline, built by AI agents. Scans for live buying signals, matches decision makers and drafts calibrated outreach openers.",
  icons: {
    icon: [
      { url: "/icon.png", href: "/icon.png" },
      { url: "/favicon.ico", href: "/favicon.ico" },
    ],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} ${plusJakarta.className} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="shortcut icon" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('revgen_theme');
                  var theme = stored === 'dark' ? 'dark' : 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                  document.documentElement.classList.remove('dark', 'light');
                  document.documentElement.classList.add(theme);

                  var path = window.location.pathname || '';
                  var search = window.location.search || '';
                  var shouldShowSplash = search.indexOf('splash=1') !== -1 || search.indexOf('splash=freeze') !== -1;
                  if (!shouldShowSplash && path.indexOf('/card/') !== 0 && path.indexOf('/api/') !== 0 && search.indexOf('nosplash=1') === -1) {
                    if (!sessionStorage.getItem('revgen_intro_splash_v1')) {
                      shouldShowSplash = true;
                    }
                  }

                  if (shouldShowSplash) {
                    document.documentElement.classList.add('revgen-splash-pending');
                    // Preload and trigger audio playback at the earliest HTML parse time
                    try {
                      var introAud = new Audio('/audio/intro.mp3');
                      introAud.preload = 'auto';
                      introAud.volume = 0.95;
                      window.__REVGEN_INTRO_AUDIO__ = introAud;
                      var p = introAud.play();
                      if (p !== undefined) {
                        p.then(function() {
                          window.__REVGEN_AUDIO_PLAYING__ = true;
                        }).catch(function() {
                          var resumeOnAnyMove = function() {
                            try {
                              introAud.play().then(function() {
                                window.__REVGEN_AUDIO_PLAYING__ = true;
                                cleanupMoveListeners();
                              }).catch(function() {});
                            } catch(e) {}
                          };
                          var cleanupMoveListeners = function() {
                            window.removeEventListener('mousemove', resumeOnAnyMove);
                            window.removeEventListener('pointermove', resumeOnAnyMove);
                            window.removeEventListener('touchstart', resumeOnAnyMove);
                            window.removeEventListener('keydown', resumeOnAnyMove);
                          };
                          window.addEventListener('mousemove', resumeOnAnyMove, { passive: true, once: true });
                          window.addEventListener('pointermove', resumeOnAnyMove, { passive: true, once: true });
                          window.addEventListener('touchstart', resumeOnAnyMove, { passive: true, once: true });
                          window.addEventListener('keydown', resumeOnAnyMove, { passive: true, once: true });
                        });
                      }
                    } catch(e) {}
                  }

                  // Universal failsafe: automatically unblock body after 3s under any circumstance (unless previewing splash)
                  if (search.indexOf('splash=freeze') === -1) {
                    setTimeout(function() {
                      try {
                        document.documentElement.classList.remove('revgen-splash-pending');
                      } catch (e) {}
                    }, 3000);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <IntroSplash />
        <ThemeProvider>
          <AuthProvider>
            {children}
            <AuthModal />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
