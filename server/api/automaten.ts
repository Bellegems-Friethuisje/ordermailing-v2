import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { adminAuth } from "../firebase-admin";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

export interface MachineItem {
  name: string;
  number: number;
  total: number;
}

const VALID_MACHINES = ["4820", "5122", "5317"] as const;

const automaten = new Hono();

// ─── Auth middleware ──────────────────────────────────────────────────────────
automaten.use("*", async (c, next) => {
  const authorization = c.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid Authorization header" });
  }
  try {
    const idToken = authorization.slice(7);
    await adminAuth.verifyIdToken(idToken);
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }
  return next();
});

// ─── GET /api/automaten?machine=XXXX ─────────────────────────────────────────
automaten.get("/", async (c) => {
  const machine = c.req.query("machine");

  if (!machine || !(VALID_MACHINES as readonly string[]).includes(machine)) {
    throw new HTTPException(400, {
      message: `Invalid machine code. Must be one of: ${VALID_MACHINES.join(", ")}`,
    });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Log in
    await page.goto("https://data.point24h.com/index.php?azione=Logout", {
      waitUntil: "networkidle2",
    });
    await page.type("#user", "bellegem");
    await page.type('input[name="posted_password"]', "MSb7@gACv");
    await Promise.all([page.click('input[name="posted_azione"]'), page.waitForNavigation()]);
    await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {});

    // Navigate to machine page
    await page.goto(`https://data.point24h.com/dev/index.php?azione=Kaart%20kast&matricola_macchina=${machine}`, {
      waitUntil: "networkidle2",
    });
    await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {});

    const html = await page.content();
    await browser.close();
    browser = undefined;

    // Parse with cheerio
    const $ = cheerio.load(html);
    const table = $("#dati");
    const tableList: string[][] = [];

    table.find("tr").each((_index: number, row) => {
      const rowList: string[] = [];
      $(row)
        .find("td")
        .each((_: number, cell) => {
          rowList.push($(cell).text().trim());
        });
      tableList.push(rowList);
    });

    const items: MachineItem[] = [];
    let fries = 0;

    tableList.forEach((element) => {
      if (element.length !== 0 && !element[4]?.includes("↑") && element[4] !== "" && element[4] !== undefined) {
        let name = element[4];
        if (name.includes("Verse frietjes")) {
          fries++;
          if (fries > 3) {
            name = "Verse frietjes Klein (voorgebakken)";
          }
        }
        const number = Number(element[5]);
        const total = Number(element[6]);
        if (!isNaN(number) && !isNaN(total)) {
          items.push({ name, number, total });
        }
      }
    });

    return c.json({ ok: true, machine, items });
  } catch (err) {
    if (browser) {
      await browser.close().catch(() => {});
    }
    console.error("[automaten] Error scraping machine", machine, err);
    throw new HTTPException(500, { message: "Failed to fetch machine data" });
  }
});

export { automaten as automatenRouter };
