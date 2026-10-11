'use strict';

const { handleHealth } = require('../lib/handlers');

module.exports = async function (context, req) {
  context.res = await handleHealth({
    method: req.method,
    headers: req.headers || {},
    env: process.env,
  });
};
