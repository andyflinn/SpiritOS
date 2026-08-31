const http = require('http');
const fs = require('fs');
const path = require('path');
const spirit = require('./kernel');

//console.log(JSON.stringify(spirit,null,2));

const ROOT_DIR = spirit.core.node.const.ROOT_DIR;
const MIME_TYPES = spirit.core.const.MIME_TYPES;
const port = process.env.PORT || spirit.core.node.const.DEFAULT_SPIRIT_PORT;

const jobs = require('./jobs')(spirit, port);
jobs.startFsWatcherJob(ROOT_DIR);

const requestCounters = { total: 0, byMethod: {}, byStatusClass: {} };
jobs.startStatsJob({ requestCounters: requestCounters });

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const fsPath = spirit.core.node.util.fsPath;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function handleSseConnection(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write('event: snapshot\ndata: ' + JSON.stringify({ jobs: jobs.listJobs() }) + '\n\n');

  const onJobUpdated = (job) => {
    res.write('event: job-updated\ndata: ' + JSON.stringify(job) + '\n\n');
  };
  jobs.events.on('job-updated', onJobUpdated);

  const heartbeat = setInterval(() => {
    res.write(':\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    jobs.events.off('job-updated', onJobUpdated);
  });
}

function handleCreateJob(req, res) {
  readJsonBody(req).then((body) => {
    const job = jobs.startProcessJob(body.command, body.args || [], { type: body.type });
    res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(job));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

function handleJobUpdate(req, res, id) {
  readJsonBody(req).then((body) => {
    const job = jobs.updateJob(id, body);
    if (!job) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(job));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

function handleCancelJob(res, id) {
  const job = jobs.cancelJob(id);
  if (!job) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(job));
}

const server = http.createServer((req, res) => {
  requestCounters.total++;
  requestCounters.byMethod[req.method] = (requestCounters.byMethod[req.method] || 0) + 1;
  res.on('finish', () => {
    const bucket = Math.floor(res.statusCode / 100) + 'xx';
    requestCounters.byStatusClass[bucket] = (requestCounters.byStatusClass[bucket] || 0) + 1;
  });

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'GET' && pathname === '/api/events') {
    handleSseConnection(req, res);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/jobs') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(jobs.listJobs()));
    return;
  }

  if (req.method === 'GET') {
    const filePath = pathname === '/'
      ? path.join(ROOT_DIR, 'index.html')
      : fsPath(ROOT_DIR, pathname);

    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    sendFile(res, filePath);
    return;
  }

  if (req.method === 'POST') {
    if (pathname === '/api/jobs') {
      handleCreateJob(req, res);
      return;
    }

    const cancelMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/cancel$/);
    if (cancelMatch) {
      handleCancelJob(res, cancelMatch[1]);
      return;
    }

    const jobIdMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (jobIdMatch) {
      handleJobUpdate(req, res, jobIdMatch[1]);
      return;
    }

    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('POST accepted');
      return;
    }

    res.writeHead(405, { 'Allow': 'POST /' });
    res.end('POST only permitted at /');
    return;
  }

  res.writeHead(405, { 'Allow': 'GET, POST' });
  res.end('Method not allowed');
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
