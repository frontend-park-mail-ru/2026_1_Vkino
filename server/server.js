/**
 * @fileoverview Небольшой HTTP-сервер для отдачи статических файлов фронтенда
 * и runtime-конфига (`/config.js`).
 */
const http = require("http"); // работа с сетью
const fs = require("fs"); // работа с файлами
const path = require("path"); // обработка путей

/** @type {number} */
const port = 3000;

/** @type {string} */
const pub = path.resolve(__dirname, "..", "src");

/** @type {Record<string, string>} */
const mapMime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

http
  /**
   * Обрабатывает входящие HTTP-запросы и отдает либо статический ресурс,
   * либо `index.html` для клиентского роутера.
   *
   * @param {import("http").IncomingMessage} req
   * @param {import("http").ServerResponse} res
   * @returns {void}
   */
  .createServer((req, res) => {
    // срезаем query
    const requestPath = decodeURIComponent(req.url.split("?")[0]);

    // Динамически отдаем конфиг для браузера
    if (requestPath === "/config.js") {
      const baseUrl = process.env.BASE_URL || "http://localhost:8080";

      res.writeHead(200, {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      });

      return res.end(`
            window.APP_CONFIG = Object.freeze({
                BASE_URL: ${JSON.stringify(baseUrl)}
            });
        `);
    }

    // есть расширение — отдаем файл, иначе отдаем index.html.
    const filePath = path.extname(requestPath)
      ? path.join(pub, requestPath)
      : path.join(pub, "index.html");

    if (!filePath.startsWith(pub)) {
      // от дурака на ../
      res.writeHead(403);
      return res.end("403");
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        // не нашли файл
        res.writeHead(404);
        return res.end("404");
      }
      res.writeHead(200, {
        "Content-Type":
          mapMime[path.extname(filePath)] || "application/octet-stream",
      });
      res.end(data);
    });
  })
  .listen(port, () => console.log(`Сервер работает на ${port} порту`));
