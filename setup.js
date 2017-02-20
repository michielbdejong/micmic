var https = require('https');
var passwords = require('./passwords');

function checkUrl(hostname, path) {
  return new Promise((resolve) => {
    var request = https.request({
      hostname: hostname,
      port:443,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': 'Basic '+(new Buffer('micmic:'+passwords[hostname]).toString('base64'))
      }
    }, function(response) {
      var str = '';
      response.on('data', function (chunk) {
        str += chunk;
      });

      response.on('end', function () {
        resolve({ status: response.statusCode, body: str });
      });
    });
    request.setTimeout(5000, function(err) {
      resolve({ error: 'Timed out' });
    });
    request.on('error', function(err) {
      resolve({ error: 'Connection error' });
    });
    request.end();
  });
}

var config = {};

function queryBalance(host) {
  return checkUrl(host, '/ledger/accounts/micmic').then(res => {
    var balance = 0;
    try {
      balance = JSON.parse(res.body).balance;
    } catch(e) {
      return;
    }
    if (balance > 1) {
      return checkUrl(host, '/ledger').then(res => {
        try {
          body = JSON.parse(res.body);
        } catch(e) {
          return;
        }
        config[body.ilp_prefix] = {
          currency: body.currency_code,
          plugin: 'ilp-plugin-bells',
          options: {
            account: 'https://' + host + '/ledger/accounts/micmic',
            username: 'micmic',
            password: passwords[host]
          }
        };
      });
    }
  });
}

var promises = [];
for (var host in passwords) {
  promises.push(queryBalance(host));
}
Promise.all(promises).then(results => {
  console.log(JSON.stringify(config));
});
