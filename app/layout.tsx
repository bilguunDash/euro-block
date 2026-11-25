import { AuthProvider } from '@/components/AuthProvider';
import { NextAuthProvider } from '@/components/NextAuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import './globals.css';

export const metadata = {
  title: 'Евроблок Ээлжийн Бүртгэл',
  description: 'Евроблок Үйлдвэрийн Ээлжийн Бүртгэлийн Систем',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Харанхуй горим — React ачаалагдахаас өмнө тавина (цагаан гялсхийхгүй). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: `
          if(typeof crypto!=='undefined'&&typeof crypto.randomUUID!=='function'){
            crypto.randomUUID=function(){
              return([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,function(c){
                return(c^(Math.random()*16>>c/4)).toString(16);
              });
            };
          }
        `}} />
      </head>
      <body suppressHydrationWarning>
        <ErrorBoundary>
          <NextAuthProvider>
            <AuthProvider>
              <ToastProvider>{children}</ToastProvider>
            </AuthProvider>
          </NextAuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
