/**
 * Client to connect to a darkwallet gateway.
 * TODO camelcase methods
 */
(function(){
    "use strict";

    /**
     * Client to connect to a darkwallet gateway.
     *
     * @param {String}   connect_uri Gateway websocket URI
     * @param {Function} handle_connect Callback to run when connected
     * @param {Function} [handle_disconnect] Callback to run when disconnected
     * @param {Function} [handle_error] Callback to run on errors (except connection errors go to handle_connect first parameter).
     *
     * handle_* callbacks take parameters as (error, data)
     */
    function GatewayClient(connect_uri, handle_connect, handle_disconnect, handle_error) {
        var self = this;
        this.handler_map = {};
        this.connected = false;
        this.websocket = new WebSocket(connect_uri);
        var closingCb;
        this.close = function(_cb) {
            self.connected = false;
            self.handler_map = {};
            closingCb = _cb;
            self.websocket.close();
        };
        this.websocket.onopen = function() {
            self.connected = true;
            handle_connect();
        };
        this.websocket.onclose = function(evt) {
            self.connected = false;
            self.on_close(evt);
            if (handle_disconnect) {
                handle_disconnect(null, evt)
            }
            if (closingCb) {
                closingCb();
                closingCb = false;
            }
        };
        this.websocket.onerror = function(evt) {
            self.on_error(evt);
            // TODO: should probably disconnect
            if (!self.connected) {
                handle_connect(evt);
            } else if (handle_error) {
                handle_error(evt);
            }
        };
        this.websocket.onmessage = onMessage.bind(this);
    }

    /**
     * Make requests to the server
     *
     * @param {String} command
     * @param {Array} params
     * @param {Function} handler
     */
    function makeRequest(command, params, handler) {
        checkFunction(handler);
        var id = randomInteger();
        var message = JSON.stringify({
            id: id,
            command: command,
            params: params
        });
        this.websocket.send(message);
        this.handler_map[id] = handler;
    }

    /**
     * (Pseudo-)Random integer generator
     *
     * @return {Number} Random integer
     */
    function randomInteger() {
        return Math.floor((Math.random() * 4294967296));
    }

    /**
     * Checks if param can be executed
     *
     * @param {Function} func to be checked
     *
     * @throws {String} Parameter is not a function
     */
    function checkFunction(func) {
        if(typeof func !== 'function') throw "Parameter is not a function";
    }

    /**
     * After triggering message event, calls to the handler of the petition
     *
     * @param {Object} evt event
     */
    function onMessage(evt) {
        var response = JSON.parse(evt.data);
        var id = response.id;
        // Should be a separate map entirely. This is a hack.
        if (response.type == "update")
            id = "update." + response.address;
        if (response.type == "chan_update")
            id = "chan.update." + response.thread;
        // Prefer flat code over nested.
        var handler = this.handler_map[id];
        if (handler) {
            handler(response);
        }else{
            console.log("Handler not found", id);
        }
    }

    /**
     * METHODS
     */

    /**
     * Get last height
     *
     * @param {Function} handle_fetch Callback to handle the returned height
     */
    GatewayClient.prototype.fetch_last_height = function(handle_fetch) {
        checkFunction(handle_fetch);
        makeRequest.call(this, "fetch_last_height", [], function(response) {
            handle_fetch(response.error, response.result[0]);
        });
    };

    /**
     * Fetch transaction
     *
     * @param {String} tx_hash Transaction identifier hash
     * @param {Function} handle_fetch Callback to handle the JSON object representing the transaction
     */
    GatewayClient.prototype.fetch_transaction = function(tx_hash, handle_fetch) {
        checkFunction(handle_fetch);
        makeRequest.call(this, 'fetch_transaction', [tx_hash], function(response) {
            handle_fetch(response.error, response.result[0]);
        });
    };

    /**
     * Fetch history
     *
     * @param {String} address
     * @param {Number} height
     * @param {Function} handle_fetch Callback to handle the JSON object representing the history of the address
     */
    GatewayClient.prototype.fetch_history = function(address, height, handle_fetch) {
        height = height || 0;
        checkFunction(handle_fetch);
        makeRequest.call(this, 'fetch_history', [address, height], function(response) {
            handle_fetch(response.error, response.result[0]);
        });
    };

    /**
     * Fetch stealth
     * TODO: move params order
     *
     * @param {Array} prefix
     * @param {Function} handle_fetch
     * @param {Number} from_height
     */
    GatewayClient.prototype.fetch_stealth = function(prefix, handle_fetch, from_height){
        checkFunction(handle_fetch);
        makeRequest.call(this, 'fetch_stealth', [prefix, from_height], function(response) {
            handle_fetch(response.error, response.result[0]);
        });
    };

    /**
     * Subscribe
     *
     * @param {String} address
     * @param {Function} handle_fetch Callback to handle subscription result
     * @param {Function} handle_update Callback to handle the JSON object representing for updates
     */
    GatewayClient.prototype.subscribe = function(address, handle_fetch, handle_update){
        checkFunction(handle_fetch);
        var handle_map = this.handler_map;
        makeRequest.call(this, 'subscribe_address', [address], function(response) {
            handle_fetch(response.error, response.result[0]);
            if (handle_update ) {
                checkFunction(handle_update);
                handle_map['update.' + address] = handle_update;
            }
        });
    };

    /**
     * Unsubscribe
     *
     * @param {String} address
     * @param {Function} handle_fetch Callback to handle subscription result representing for updates
     */
    GatewayClient.prototype.unsubscribe = function(address, handle_fetch){
        checkFunction(handle_fetch);
        if (this.handler_map['update.' + address]) {
            delete this.handler_map['update.' + address];
        }
        makeRequest.call(this, 'unsubscribe_address', [address], function(response) {
            handle_fetch(response.error, response.result[0]);
        });
    };

    /**
     * Fetch block header
     *
     * @param {Number} index
     * @param {Function} handle_fetch
     */
    GatewayClient.prototype.fetch_block_header = function(index, handle_fetch) {
        checkFunction(handle_fetch);
        makeRequest.call(this, 'fetch_block_header', [index], function(response) {
            handle_fetch(response.error, response.result[0]);
        });
    };

    /**
     *  Fetch block transaction hashes
     *
     *  @param {Number} index
     *  @param {Function} handle_fetch
     */
    GatewayClient.prototype.fetch_block_transaction_hashes = function(index, handle_fetch) {
        checkFunction(handle_fetch);
        makeRequest.call(this, "fetch_block_transaction_hashes", [index], function(response) {
            handle_fetch(response.error, response.result[0]);
        });
    };

    /**
     *  Fetch spend
     *
     *  @param {Array} outpoint
     *  @param {Function} handle_fetch
     */
    GatewayClient.prototype.fetch_spend = function(outpoint, handle_fetch) {
        checkFunction(handle_fetch);
        makeRequest.call(this, 'fetch_spend', [outpoint], function(response) {
            handle_fetch(response.error, response.result[0]);
        });
    };

    /**
     *  Fetch transaction index
     *
     *  @param {String} tx_hash
     *  @param {Function} handle_fetch
     */
    GatewayClient.prototype.fetch_transaction_index = function(tx_hash, handle_fetch){
        checkFunction(handle_fetch);
        makeRequest.call(this, 'fetch_transaction_index', [tx_hash], function(response) {
            var result = response.result;
            handle_fetch(response["error"], result[0], result[1]);
        });
    };

    /**
     *  Fetch block height
     *
     *  @param {String} blk_hash
     *  @param {Function} handle_fetch
     */
    GatewayClient.prototype.fetch_block_height = function(blk_hash, handle_fetch){
        checkFunction(handle_fetch);
        makeRequest.call(this, 'fetch_block_height', [blk_hash], function(response) {
            handle_fetch(response.error, response.result[0]);
        });
    };

    /**
     *  Broadcast transaction
     *
     *  @param {String} raw_tx
     *  @param {Function} handle_fetch
     */
    GatewayClient.prototype.broadcast_transaction = function(raw_tx, handle_fetch){
        checkFunction(handle_fetch);
        makeRequest.call(this, 'broadcast_transaction', [raw_tx], function(response) {
            handle_fetch(response.error, response.result[0]);
        });
    };

    /**
     * Renew
     *
     * @param {String} address
     * @param {Function} handle_fetch Callback to handle subscription result
     * @param {Function} handle_update Callback to handle the JSON object representing for updates
     */
    GatewayClient.prototype.renew = function(address, handle_fetch, handle_update) {
        var handler_map = this.handler_map;
        makeRequest.call(this, 'renew_address', [address], function(response) {
            handle_fetch(response.error, response.result[0]);
            if (handle_update) {
                checkFunction(handle_update);
                handler_map['update.' + address] = handle_update;
            }
        });
    };

    /**
     * Chan post
     *
     * @param {String} section_name
     * @param {String} thread_id
     * @param {String} data
     * @param {Function} handle_fetch
     */
    GatewayClient.prototype.chan_post = function(section_name, thread_id, data, handle_fetch) {
        checkFunction(handle_fetch);
        makeRequest.call(this, 'chan_post', [section_name, thread_id, data], function(response) {
            handle_fetch(response.error, response.result);
        });
    };

    /**
     * Chan list
     *
     * @param {String} section_name
     * @param {Function} handle_fetch
     */
    GatewayClient.prototype.chan_list = function(section_name, handle_fetch) {
        checkFunction(handle_fetch);
        makeRequest.call(this, 'chan_list', [section_name], function(response) {
            handle_fetch(response.error, response.result);
        });
    };

    /**
     *  Chan get
     *
     * @param {String} section_name
     * @param {String} thread_id
     * @param {Function} handle_fetch
     */
    GatewayClient.prototype.chan_get = function(section_name, thread_id, handle_fetch) {
        checkFunction(handle_fetch);
        makeRequest.call(this, 'chan_get', [section_name, thread_id], function(response) {
            handle_fetch(response.error, response.result);
        });
    };

    /**
     * Chan subscribe
     *
     * @param {String} section_name
     * @param {String} thread_id
     * @param {Function} handle_fetch
     * @param {Function} handle_update
     */
    GatewayClient.prototype.chan_subscribe = function(section_name, thread_id, handle_fetch, handle_update) {
        checkFunction(handle_fetch);
        var handler_map = this.handler_map;
        makeRequest.call(this, 'chan_subscribe', [section_name, thread_id], function(response) {
            handle_fetch(response.error, response.result);
            if (handle_update) {
                checkFunction(handle_update);
                handler_map["chan.update." + thread_id] = handle_update;
            }
        });
    };

    /**
     * Chan subscribe
     *
     * @param {String} section_name
     * @param {String} thread_id
     * @param {Function} handle_fetch
     */
    GatewayClient.prototype.chan_unsubscribe = function(section_name, thread_id, handle_fetch) {
        checkFunction(handle_fetch);
        var handler_map = this.handler_map;
        makeRequest.call(this, 'chan_unsubscribe', [section_name, thread_id], function(response) {
            handle_fetch(response.error, response.result);
            if (handler_map['chan.update.' + thread_id]) {
                delete handler_map['chan.update.' + thread_id];
            }
        });
    };

    /**
     * Ticker functionality
     *
     * @param {String} currency Like USD, EUR...
     * @param {Function} handle_fetch
     */
    GatewayClient.prototype.fetch_ticker = function(currency, handle_fetch){
        checkFunction(handle_fetch);
        makeRequest.call(this, 'fetch_ticker', [currency], function(response) {
            handle_fetch(response.error, response.result[0]);
        });
    };

    /**
     * Error event handler
     *
     * @param {Object} evt event
     *
     * @throws {Object}
     */
    GatewayClient.prototype.on_error = function(evt){
        throw evt;
    };

    /**
     * Close event handler
     *
     * @param {Object} evt event
     */
    GatewayClient.prototype.on_close = function(evt){};

    // Expose at window
    window.GatewayClient = GatewayClient;

    // Expose as AMD module
    if (typeof window.define === "function" && window.define.amd) {
        window.define("GatewayClient", [], function() {
            return window.GatewayClient;
        });
    }

})();