import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger as createViteLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { createLogger } from './utils/logger';

const logger = createLogger('Vite');
const viteLogger = createViteLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  logger.info(`${formattedTime} [${source}] ${message}`);
}

/**
 * Inject CSP nonce into script and style tags in HTML
 * SECURITY: This allows scripts/styles to execute under strict CSP without 'unsafe-inline'
 *
 * @param html - The HTML template string
 * @param nonce - The cryptographic nonce for this request
 * @returns HTML with nonce attributes added to script/style tags
 */
function injectNonceIntoHtml(html: string, nonce: string): string {
  if (!nonce) return html;

  // Inject nonce into all <script> tags (excluding external scripts)
  // Match: <script and not already having nonce=
  html = html.replace(
    /<script(?![^>]*nonce=)([^>]*)>/gi,
    `<script nonce="${nonce}"$1>`
  );

  // Inject nonce into all <style> tags
  html = html.replace(
    /<style(?![^>]*nonce=)([^>]*)>/gi,
    `<style nonce="${nonce}"$1>`
  );

  return html;
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  // path-to-regexp 8.x requires named wildcards - use "*path" instead of "*"
  app.use("*path", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      // First, let Vite transform the HTML (adds HMR and dev scripts)
      let page = await vite.transformIndexHtml(url, template);

      // SECURITY: Inject CSP nonce into script tags AFTER Vite transformation
      // This ensures Vite's injected inline scripts also get nonces
      const nonce = res.locals.cspNonce || '';
      page = injectNonceIntoHtml(page, nonce);

      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Cache the index.html template to avoid reading from disk on every request
  const indexPath = path.resolve(distPath, "index.html");
  let cachedTemplate: string | null = null;

  try {
    cachedTemplate = fs.readFileSync(indexPath, "utf-8");
  } catch (error) {
    logger.error('Failed to read index.html template:', { error });
  }

  // fall through to index.html if the file doesn't exist
  // path-to-regexp 8.x requires named wildcards - use "*path" instead of "*"
  app.use("*path", (_req, res) => {
    // SECURITY: Inject CSP nonce into the HTML template
    const nonce = res.locals.cspNonce || '';

    if (cachedTemplate && nonce) {
      // Inject nonce into the cached template
      const htmlWithNonce = injectNonceIntoHtml(cachedTemplate, nonce);
      res.status(200).set({ "Content-Type": "text/html" }).send(htmlWithNonce);
    } else if (cachedTemplate) {
      // Fallback: serve without nonce if not available (shouldn't happen)
      res.status(200).set({ "Content-Type": "text/html" }).send(cachedTemplate);
    } else {
      // Fallback: use sendFile if cache failed
      res.sendFile(indexPath);
    }
  });
}
