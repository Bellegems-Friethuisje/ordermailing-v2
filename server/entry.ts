import { sentryServerConfig } from "./sentry.server.config";
import { apply, serve } from "@photonjs/hono";
import { Hono } from "hono";
import * as Sentry from "@sentry/node";
import { usersRouter } from "./api/users";
import { suppliersRouter } from "./api/suppliers";
import { ordersRouter } from "./api/orders";
import { automatenRouter } from "./api/automaten";
import { designsRouter } from "./api/designs";

sentryServerConfig();

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

export default startApp() as unknown;

function startApp() {
  const app = new Hono();

  app.get("/api/sentry-test", (c) => {
    try {
      throw new Error("Test backend Sentry error");
    } catch (err) {
      Sentry.captureException(err);
      return c.json({ ok: false, error: "Backend error captured by Sentry" }, 500);
    }
  });

  app.route("/api/users", usersRouter);
  app.route("/api/suppliers", suppliersRouter);
  app.route("/api/orders", ordersRouter);
  app.route("/api/automaten", automatenRouter);
  app.route("/api/designs", designsRouter);

  apply(app, []);

  return serve(app, {
    port,
  });
}
