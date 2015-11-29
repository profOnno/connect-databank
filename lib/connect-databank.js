// connect-databank.js
//
// Store connect session in a databank
//
// Copyright 2012-2013 E14N Inc. http://e14n.com/
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//require("set-immediate");

var _ = require("underscore"),
    uuid = require("node-uuid"),
    util = require("util"),
    async = require("async");

module.exports = function(session) {

    var Store = session.Store,
        isActive = function(session) {

            var expires;

            if ('string' == typeof session.cookie.expires) {
                expires = new Date(session.cookie.expires);
            } else {
                expires = session.cookie.expires;
            }
            
            if (!expires || Date.now() < expires) {
                return true;
            } else {
                return false;
            }
        },
        noop = function(){};


    var DatabankStore = function(_bank, parentLog, cleanupInterval) {

        var store = this;
            
        Store.call(this); //initialse the session store on this context
        this.bank=_bank;
    
        if (parentLog) {
            this.log = parentLog.child({component: "connect-databank"});
        }
        
        // Set up cleanup to happen every so often.

        if (cleanupInterval) {
            // Since there may be multiple processes trying to clean up,
            // We stagger our cleanup randomly somewhere over the interval period
            store.timeout = setTimeout(function() {
                var doCleanup = function() {
                    store.cleanup(function(err) {
                        if (err) {
                            if (store.log) store.log.error(err, "Error cleaning up sessions");
                        } else {
                            if (store.log) store.log.debug("Finished cleaning up sessions.");
                        }
                    });
                    
                    
                };
                doCleanup();
                store.interval = setInterval(function() {
                    doCleanup();
                }, cleanupInterval);
            }, Math.floor(Math.random()*cleanupInterval));
            
        }
    }

    // A schema, for those who want it
    DatabankStore.schema = {
           session: {
               pkey: "sid"
            }
    }

    util.inherits(DatabankStore, Store);

    DatabankStore.prototype.get = function(sid, fn) {
        var self=this;

        if (!fn) fn = noop;

        async.waterfall([
            function(callback) {
                self.bank.read("session", sid, function(err, session) {
                    if (err && err.name == "NoSuchThingError") {
                        if (self.log) self.log.debug({sid: sid}, "No session in get()");
                        callback(null, null);
                        return 
                    } else if (err) {
                        callback(err, null);
                    } else {
                        callback(null, session);
                    }
                });
            },
            function(session, callback) {
                if (!session) {
                    callback(null, session);
                } else if (!isActive(session)) {
                    // delete it later
                    // XXX: should we just leave it for cleanup()?
                    setImmediate(function() {
                        self.bank.del("session", sid, function(err) {
                            if (err) {
                                if (self.log) self.log.error({err: err, sid: sid}, "Error deleting inactive session");
                            } else {
                                if (self.log) self.log.debug({sid: sid}, "Inactive session; deleted.");
                            }
                        });
                    });
                    callback(null, null);
                } else {
                    callback(null, session);
                }
            }
        ], function(err, session) {
            if (err) {
                if (self.log) self.log.error(err);
                return fn(err, null);
            } else {
                if (self.log) self.log.debug({sid: sid, session: session}, "Got session.");
                return fn(null, session);
            }
        });
        
    };

    DatabankStore.prototype.set = function(sid, sess, callback) {
        var self=this;

        if (!callback) callback = noop;

        // connect sets this... usually.
        if (!_.has(sess, "sid")) {
            sess.sid = sid;
        }

        async.waterfall([
            function(callback) {
                self.bank.save("session", sid, sess, function(err,res){
                    callback(err,res);
                });
            }
        ], function(err, saved) {
            if (err) {
                if (self.log) self.log.error(err);
                //callback(err);
                return callback(err);
            } else {
                if (self.log) self.log.debug({sid: sid, session: sess}, "Saved session.");
                //callback(null);
                return callback(null);
            }
        });
    };

    DatabankStore.prototype.destroy = function(sid, callback) {
        var self=this;
        if (!callback) callback = noop;

        async.waterfall([
            function(callback) {
                self.bank.del("session", sid, callback);
            }
        ], function(err) {
            if (err && err.name == "NoSuchThingError") {
                if (self.log) self.log.debug({sid: sid}, "Destroy for non-existent session; all good.");
                return callback(null);
            } else if (err) {
                if (self.log) self.log.error(err);
                return callback(err);
            } else {
                if (self.log) self.log.debug({sid: sid}, "Destroy for found session");
                return callback(null);
            }
        });
        
    };

    DatabankStore.prototype.all = function(callback) {
        var self = this;
        if (!callback) callback = noop;

        var session =[];
        
        async.waterfall([
            function(callback) {
                var sessions = [],
                    keepActive = function(session) {
                        if (isActive(session)) {
                            sessions.push(session);
                        }
                    };
                self.bank.scan("session", keepActive, function(err) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, sessions);
                    }
                });
            }
        ], function(err, sessions) {
            if (err) {
                if (self.log) self.log.error(err);
                return callback(err, null);
            } else {
                if (self.log) self.log.debug({count: sessions.length}, "Retrieved all sessions");
                return callback(null, sessions);
            }
        });
    }

    DatabankStore.prototype.length = function(fn) {
        var self = this;

        if (!fn) fn = noop;

        async.waterfall([
            function(fn) {
                var lng = 0,
                    incr = function(session) { lng++; };
                self.bank.scan("session", incr, function(err) {
                    if (err) {
                        fn(err, null);
                    } else {
                        fn(null, lng);
                    }
                });
            }
        ], function(err, lng) {
            if (err) {
                if (self.log) self.log.error(err);
                return fn(err, null);
            } else {
                if (self.log) self.log.debug({length: lng}, "Retrieved count of sessions");
                return fn(null, lng);
            }
        });
    };

    DatabankStore.prototype.clear = function(callback) {
        var self = this;
        if (!callback) callback = noop;

        async.waterfall([
            function(callback) {
                var sids = [];
                self.bank.scan("session", function(session) { sids.push(session.sid); }, function(err) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, sids);
                    }
                });
            },
            function(sids, callback) {
                var delSid = function(sid, callback) {
                    self.bank.del("session", sid, callback);
                };
                async.eachLimit(sids, 16, delSid, callback);
            }
        ], function(err) {
            if (err) {
                if (self.log) self.log.error(err);
                return callback(err);
            } else {
                if (self.log) self.log.debug("Cleared all sessions.");
                return callback(null);
            }
        });
    };

    // XXX: should this be public?

    DatabankStore.prototype.cleanup = function(callback) {

        var cid = uuid.v4(),
            self = this,
            q,
            cleanupSession = function(sid, callback) {
                
               if (self.log) self.log.debug({sid: sid, cid: cid}, "Deleting inactive session.");
                
                self.bank.del("session", sid, function(err) {
                    if (err && err.name == "NoSuchThingError") {
                        if (self.log) self.log.debug({sid: sid, cid: cid}, "Missing inactive session on delete; ignoring.");
                        callback(null);
                    } else if (err) {
                        if (self.log) self.log.error({sid: sid, cid: cid, err: err}, "Error deleting this session.");
                        callback(err);
                    } else {
                        if (self.log) self.log.debug({sid: sid, cid: cid}, "Successfully deleted session.");
                        callback(null);
                    }
                });
            },
            check = function(session) {
                setImmediate(function() {
                    //isActive
                    if (isActive(session)) {
                        if (self.log) self.log.debug({sid: session.sid, cid: cid}, "Ignoring active session.");
                    } else {
                        if (self.log) self.log.debug({sid: session.sid, cid: cid}, "Queuing inactive session for cleanup.");
                        q.push(session.sid); 
                    }
                });
            },
            scanDone = false;

        if (self.log) self.log.debug({cid: cid}, "Starting cleanup.");
        
        q = async.queue(cleanupSession, 16);

        q.drain = function() {
            if (self.log) self.log.debug({cid: cid}, "Queue is empty.");
            if (scanDone) {
                if (self.log) self.log.debug({cid: cid}, "Finished cleaning up.");
                callback(null);
            }
        };

        self.bank.scan("session", check, function(err) {
            if (err) {
                if (self.log) self.log.error({cid: cid, err: err}, "Error scanning sessions.");
                callback(err);
            } else {
                if (self.log) self.log.debug({cid: cid}, "Finished scanning sessions; waiting for queue to drain.");
                scanDone = true;
            }
        });
    };

        // This is weird

    //DatabankStore.prototype.__proto__ = Store.prototype;

    DatabankStore.prototype.close = function(){
        var self = this;
        clearInterval(self.interval);
        clearTimeout(self.timoute);
    }

    return DatabankStore;
};
