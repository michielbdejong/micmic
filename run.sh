#!/bin/sh
export CONNECTOR_LEDGERS=`node setup.js`
SLIPPAGE=0 FX_SPREAD=0 CONNECTOR_AUTOLOAD_PEERS=true DEBUG=ilp-* npm start
