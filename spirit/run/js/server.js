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

  const onJobDeleted = (id) => {
    res.write('event: job-deleted\ndata: ' + JSON.stringify(id) + '\n\n');
  };
  jobs.events.on('job-deleted', onJobDeleted);

  const heartbeat = setInterval(() => {
    res.write(':\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    jobs.events.off('job-updated', onJobUpdated);
    jobs.events.off('job-deleted', onJobDeleted);
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

function handleDeleteJob(res, id) {
  const deleted = jobs.deleteJob(id);
  if (!deleted) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found, or job is not yet in a terminal state');
    return;
  }
  res.writeHead(204);
  res.end();
}

function writeFsResult(res, result) {
  if (result.ok) {
    res.writeHead(204);
    res.end();
    return;
  }
  if (result.reason === 'forbidden') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  if (result.reason === 'app-entry-script-protected') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden: an app\'s own entry script cannot be overwritten');
    return;
  }
  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Internal error');
}

function handleFsSave(req, res) {
  readJsonBody(req).then((body) => {
    writeFsResult(res, spirit.core.fs.saveFile(body.path, body.content));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

function handleFsDelete(req, res) {
  readJsonBody(req).then((body) => {
    writeFsResult(res, spirit.core.fs.deleteFile(body.path));
  }).catch(() => {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Invalid JSON body');
  });
}

// LM Studio's local server sends no Access-Control-Allow-Origin header, so a
// browser fetch() straight from this page (a different origin/port) is
// silently blocked by CORS even though LM Studio itself is reachable and
// responding fine (curl doesn't enforce CORS, only browsers do). Proxying
// through our own server sidesteps this entirely — server-to-server requests
// aren't subject to CORS at all.
function handleLmStudioModels(res) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  fetch('http://localhost:1234/v1/models', { signal: controller.signal })
    .then((response) => {
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('LM Studio returned ' + response.status);
      return response.json();
    })
    .then((body) => {
      const ids = (body.data || []).map((m) => m.id);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ models: ids }));
    })
    .catch(() => {
      clearTimeout(timeoutId);
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ models: [], error: 'LM Studio unreachable' }));
    });
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

  if (req.method === 'GET' && pathname === '/api/lm-studio-models') {
    handleLmStudioModels(res);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/fs/stat') {
    const stats = spirit.core.fs.statFile(url.searchParams.get('path') || '');
    if (!stats) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(stats));
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
    if (pathname === '/api/fs/save') {
      handleFsSave(req, res);
      return;
    }

    if (pathname === '/api/fs/delete') {
      handleFsDelete(req, res);
      return;
    }

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

  if (req.method === 'DELETE') {
    const jobIdMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (jobIdMatch) {
      handleDeleteJob(res, jobIdMatch[1]);
      return;
    }
  }

  res.writeHead(405, { 'Allow': 'GET, POST, DELETE' });
  res.end('Method not allowed');
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
