'use strict'

const COMMISSION = 1.3;

const Plugin = require('ilp-plugin-bells');

// TODO: wrap this into ilp-plugin-bells, see https://github.com/interledgerjs/ilp-plugin-bells/issues/107
function getPlugin(host, user, pass) {
  return new Promise(resolve => {
    require('request')({
      method: 'get',
      uri: `https://${host}/ledger`,
      json: true,
    }, (err, sendRes, body) => {
      console.log('prefix', host, body.ilp_prefix);
      resolve(new Plugin({
        prefix: body.ilp_prefix,
        account: `https://${host}/ledger/accounts/${user}`,
        password: pass,
      }));
    });
  });
}

function MicMic(passwords) {
  this.passwords = passwords;
  this.plugins = {};
  this.balances = {};
  this.peers = {};
  this.prefix2host = {};
}

MicMic.prototype = {
  connect() {
    var promises = [];
    for (var host in this.passwords) {
      promises.push(this.initHost(host));
    }
    return Promise.all(promises);
  },
  initHost(host) {
    return getPlugin(host, 'micmic', this.passwords[host]).then(plugin => {
      this.plugins[host] = plugin;
      console.log('connecting', host);
      return plugin.connect();
    }).then(() => {
      console.log('connected', host);
      this.plugins[host].on('incoming_message', res => {
        this.handleMessage(host, res);
      });
      this.sendTestMessage(host);
    });
  },
  sendTestMessage(host) {
    var prefix = this.plugins[host].getInfo().prefix;
    this.prefix2host[prefix] = host;
    var msg = {
      from: prefix + 'micmic',
      to: prefix + 'micmic',
      ledger: prefix,
      data: { method: 'initial_connection_test' },
    };
    this.plugins[host].sendMessage(msg).then(() => {
      console.log('test msg sent', msg);
    });
  },
  handleMessage(host, res) {
    console.log('seeing message', host, res);
    if (res.data.method === 'initial_connection_test') {
      this.plugins[host].getBalance().then(balance => {
        var info = this.plugins[host].getInfo();
        info.connectors.map(conn => {
          if (conn !== info.prefix + 'micmic') {
            this.peers[host] = conn;
          }
        });
        this.balances[host] = balance;
      });
    } else if (res.data.method === 'quote_request') {
      var response = {
        from: res.to,
        to: res.from,
        ledger: res.ledger,
        data: res.data,
      };
      response.data.method = 'quote_response';
      response.data.data.source_amount = COMMISSION * response.data.data.destination_amount;
      var parts = response.data.data.destination_address.split('.');
      parts.pop();
      var destPrefix = parts.join('.') + '.';
      var destHost = this.prefix2host[destPrefix];
      if ((typeof destHost === 'string') && (this.balances[destHost] > 0.01)) { 
          response.data.data.liquidity_curve = this.getCurve(this.prefix2host[destPrefix]);
        this.plugins[host].sendMessage(response).then(() => {
          console.log('quote response sent', response);
        });
      } else {
        console.log('no quote to ledger', destPrefix, destHost, this.balances[destHost]);
      }
    }
  },
  broadcastRoutes() {
    console.log('broadcastRoutes', this.peers, this.balances);
    for (var host in this.peers) {
      var prefix = this.plugins[host].getInfo().prefix;
      var msg = {
        from: prefix + 'micmic',
        to: this.peers[host],
        ledger: prefix,
        data: {
          method: 'broadcast_routes',
          data: this.getRoutesFor(host),
          id: 'some-string',
        },
      };
      this.plugins[host].sendMessage(msg).then(() => {
        console.log('broadcast msg sent', JSON.stringify(msg, null, 2));
      });
    }
  },
  getCurve(host) {
console.log('getCurve', host, this.balances);
    return [
      [ 0.02, 0.01 ],
      [ COMMISSION * this.balances[host], 1 * this.balances[host] ]
    ];
  },
  getRoutesFor(forHost) {
    var routes = [];
    for (var host in this.balances) {
      if ((host !== forHost) && (this.balances[host] > 0.01)) { 
        routes.push({
          source_ledger: this.plugins[forHost].getInfo().prefix,
          destination_ledger: this.plugins[host].getInfo().prefix,
          points: this.getCurve(host),
          min_message_window: 1,
          source_account: this.plugins[forHost].getInfo().prefix + 'micmic',
        });
      }
    }
    return routes;
  },
};

//...
var micMic = new MicMic(require('./passwords'));
micMic.connect();
setInterval(() => {
  micMic.broadcastRoutes();
}, 10000);
