const http = require('http');

async function testPorts() {
  for (let port = 3000; port <= 3020; port++) {
    await new Promise((resolve) => {
      const req = http.request({
        host: '127.0.0.1',
        port: port,
        path: '/',
        method: 'GET',
        timeout: 200
      }, (res) => {
        console.log(`Port ${port} responds with status ${res.statusCode}`);
        resolve();
      });
      req.on('error', () => resolve());
      req.on('timeout', () => { req.abort(); resolve(); });
      req.end();
    });
  }
}

testPorts();
