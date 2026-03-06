const http = require('http'); // работа с сетью
const fs = require('fs'); // работа с файлами
const path = require('path'); // обработка путей

const port = 3000;
const pub = path.resolve(__dirname, '..', 'src');
const mapMime = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
    let p = (req.url === '/') ? '../src/index.html' : req.url; // дефолтный путь
    if (!path.extname(p)) { p += '.html'; } // + расширение файла
    
    const filePath = path.join(pub, p);
    if (!filePath.startsWith(pub)) { // от дурака на ../
        res.writeHead(403); 
        return res.end('403'); 
    }
    fs.readFile(filePath, (err, data) => {
        if (err) { // не нашли файл
            res.writeHead(404);
            return res.end('404');
        }
        res.writeHead(200, { 'Content-Type': mapMime[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(port, () => console.log(`Сервер работает на ${port} порту`));