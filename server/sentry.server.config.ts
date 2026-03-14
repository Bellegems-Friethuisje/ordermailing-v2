import * as Sentry from "@sentry/node";

export const sentryServerConfig = () => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: "production-backend",
    tracesSampleRate: 1.0,
  });
};
