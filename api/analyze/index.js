'use strict';

const { handleAnalyze, parseBody } = require('../lib/handlers');

module.exports = async function (context, req) {
  context.res = await handleAnalyze({
    method: req.method,
    headers: req.headers || {},
    body: parseBody(req),
    env: process.env,
    log: context.log,
  });
};
