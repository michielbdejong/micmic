var https = require('https');
var request = require('request');
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
      console.error(host, e);
      return;
    }
    console.log(host, balance);
    return { host, balance };
  });
}

function getLedgerDetails(host) {
  return checkUrl(host, '/ledger').then(res => {
    var details;
    try {
      details = JSON.parse(res.body);
    } catch(e) {
      console.error(host, e);
      return;
    }
    console.log(host, details);
    return details;
  });
}

function announceRoutes(routes, hostname, prefix, conn) {
// sending {
//   "auth": {
//     "user": "connectorland",
//     "pass": "*****"
//   },
//   "method": "post",
//   "uri": "https://ilp.hexdivision.com/ledger/messages",
//   "body": {
//     "ledger": "https://ilp.hexdivision.com/ledger",
//     "from": "https://ilp.hexdivision.com/ledger/accounts/connectorland",
//     "to": "https://ilp.hexdivision.com/ledger/accounts/connector",
//     "data": {
//       "method": "quote_request",
//       "data": {
//         "source_address": "us.usd.hexdivision.connectorland",
//         "destination_address": "us.usd.hexdivision.connectorland",
//         "destination_amount": "0.01"
//       },
//       "id": "us.usd.hexdivision."
//     }
//   },
//   "json": true
// }

  var req = {
    auth:  {
      user: 'micmic',
      pass: passwords[hostname],
    },
    method: 'post',
    uri: 'https://' + hostname + '/ledger/messages',
    body: {
      ledger: 'https://' + hostname + '/ledger',
      from: 'https://' + hostname + '/ledger/accounts/micmic',
      to: 'https://' + hostname + '/ledger/accounts/' + conn,
      data: {
        method: 'broadcast_routes',
        data: routes.map(route => Object.assign({
          source_ledger: prefix,
          source_account: prefix + 'micmic',
        }, route)),
        id: 'some-string',
      },
    },
    json: true
  };
console.log('sending', JSON.stringify(req, null, 2));
  request(req, (err, sendRes, body) => {
    if (err || sendRes.statusCode >= 400) {
      if (body.id === 'NoSubscriptionsError') {
        console.log(`Hi! Looks like connector '${conn}' on https://${hostname} is down?`);
      } else {
        console.log({ err, code: sendRes.statusCode, body: JSON.stringify(body, null, 2) });
      }
      return;
    }
  });
}

var promises = [];
for (var host in passwords) {
  promises.push(queryBalance(host).then(obj => {
    return getLedgerDetails(obj.host).then(obj2 => {
      return Object.assign(obj, obj2);
    });
  })); 
}
Promise.all(promises).then(results => {
  var routes = [];
  results.map(obj => {
    routes.push({
      destination_ledger: obj.ilp_prefix,
      points: [ [ 0.02, 0.01 ], [ 2 * obj.balance, 1 * obj.balance ] ],
      min_message_window: 3,
    });
  });
routes = [ routes[0] ];
  console.log(routes);
  results.map(obj => {
    obj.connectors.map(conn => {
      if (conn.name !== 'micmic') {
        announceRoutes(routes, obj.host, obj.ilp_prefix, conn.name);
process.exit(0)
      }
    });
  });
  
});
