#!/bin/sh
export CONNECTOR_LEDGERS=`node setup.js`
export SLIPPAGE=0
export FX_SPREAD=0
export CONNECTOR_AUTOLOAD_PEERS=true
export DEBUG=ilp-*
npm start
