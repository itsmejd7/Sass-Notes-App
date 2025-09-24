const app = require('../app');

module.exports = (req, res) => {
  return app(req, res);
};

const serverless = require('serverless-http');
const app = require('../app');

module.exports = serverless(app);


