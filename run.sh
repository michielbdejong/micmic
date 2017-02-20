#!/bin/sh
export CONNECTOR_LEDGERS=`node setup.js`
# CONNECTOR_AUTOLOAD_PEERS=true
DEBUG=* npm start
