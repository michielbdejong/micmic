'use strict'

const Plugin = require('ilp-plugin-bells')
const request = require('request')
const passwords = require('./passwords')

var balances = {};

function getBalance(host) {
  return new Promise(resolve => {
    var req = {
      auth: {
       user: 'micmic',
       pass: passwords[host],
      },
      method: 'get',
      uri: `https://${host}/ledger/accounts/micmic`,
      json: true,
    };
    request(req, (err, sendRes, body) => {
      resolve(body.balance);
    });
  });
}

function getPrefix(host) {
  return new Promise(resolve => {
    var req = {
      method: 'get',
      uri: `https://${host}/ledger`,
      json: true,
    };
    request(req, (err, sendRes, body) => {
      resolve(body.ilp_prefix);
    });
  });
}

function connect(host) {
  var plugin;
  var password = passwords[host];
  var account = `https://${host}/ledger/accounts/micmic`;
  
  return getBalance(host).then(balance => {
    balances[host] = balance;
    return getPrefix(host);
  }).then(prefix => {
    plugin = new Plugin({ prefix, account, password, });
    return plugin.connect();
  }).then(() => {
    plugin.on('incoming_message', res => {
      console.log('got message', res);
// { ledger: 'https://royalcrypto.com/ledger',
//   from: 'https://royalcrypto.com/ledger/accounts/connectorland',
//   to: 'https://royalcrypto.com/ledger/accounts/micmic',
//   data: 
//    { method: 'quote_request',
//      data: 
//       { source_address: 'ca.usd.royalcrypto.connectorland',
//         destination_address: 'ca.usd.royalcrypto.connectorland',
//         destination_amount: '0.01' },
//      id: 'ca.usd.royalcrypto.' },
//   account: 'https://royalcrypto.com/ledger/accounts/connectorland' }
      if (res.data.method === 'quote_request') {

//        source_address: 'example.blue.mark',
//        destination_address: 'example.red',
//        source_amount: '1',
//        destination_expiry_duration: '4'
//      }, {
//        destination_amount: '1',
//        source_connector_account: 'mock/connector',
//        source_expiry_duration: '5',
//        destination_expiry_duration: '4'

        var req = {
          auth: { user: 'micmic', pass: passwords[host] },
          method: 'post',
          uri: `https://${host}/ledger/messages`,
          body: {
            ledger: res.ledger,
            from: res.to,
            to: res.from,
            data: {
              method: 'quote_response',
              data: {
                source_amount: res.data.data.source_amount || '' + (2 * res.data.data.destination_amount),
                destination_amount: res.data.data.destination_amount || '' + (.5 * res.data.data.source_amount),
                source_connector_account: 'micmic',
                source_ledger: res.data.data.source_ledger,
                destination_ledger: res.data.data.destination_ledger,
                source_expiry_duration: 10,
                destination_expiry_duration: 5,
              },
            },
          },
          json: true,
        };
        console.log('responding', req);
        request(req , (err, sendRes, body) => {
          console.log(err, sendRes.statusCode, body);
        });
      }   
    });
    console.log('listening', host, balances[host]);
  });
}

function send(plugin, prefix, fromAddress, toAddress, destLedger, onerror) {
  var req = {
    auth:  {
      user: plugin.credentials.username,
      pass: plugin.credentials.password,
    },
    method: 'post',
    uri: plugin.ledgerContext.urls.message,
    body: {
      ledger: plugin.ledgerContext.host,
      from: fromAddress,
      to: toAddress,
      data: {
        method: 'quote_request',
        data: {
          source_address: prefix + 'connectorland',
          destination_address: destLedger + 'connectorland',
          destination_amount: '0.01',
        },
        id: destLedger
      },
    },
    json: true
  };
console.log('sending', JSON.stringify(req, null, 2));
  request(req, (err, sendRes, body) => {
    if (err || sendRes.statusCode >= 400) {
      onerror();
      return;
    }
  });
}

var connections = [];
for (var host in passwords) {
  connections.push(connect(host));
}
Promise.all(connections);
  
