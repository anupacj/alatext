import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ backgroundColor: "#000000" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AlaText" />
        <meta name="theme-color" content="#000000" />

        <ScrollViewStyleReset />
      </head>
      <body style={{ backgroundColor: "#000000", margin: 0, padding: 0, overflow: "hidden" }}>{children}</body>
    </html>
  );
}
