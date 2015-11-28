// middleware-test.js
//
// Test that stuff actually works as middleware
//
// Copyright 2012, E14N Inc.
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


var _ = require("underscore"),
    assert = require("assert"),
    vows = require("vows"),
    databank = require("databank"),
    Step = require("step"),
    stream = require("stream"),
    util = require("util"),
    Logger = require("bunyan"),
    http = require("http"),
    connect = require("connect"),
    session = require("express-session"),
    Browser = require("zombie"),
    MStore = require("../mstore").MStore,
    server = null,
    Databank = databank.Databank;

var suite = vows.describe("middleware interface");

suite.addBatch({
    "when we require the connect-databank module": {
        topic: function() {
            //return require("../lib/connect-databank");
            return require("../mstore").Store;
        },
        "it works": function(middleware) {
            assert.isFunction(middleware);
        },
        "and we apply it to the connect module": {
            topic: function(middleware) {
                //console.log(middleware.toString());
                return middleware(session);
            },
            "it works": function(DatabankStore) {
                assert.isFunction(DatabankStore);
            },
            "and we instantiate a store": {
                topic: function(DatabankStore) {
                    var callback = this.callback,
                        db = new MStore();
                        store = new DatabankStore({db:db, cookie: {maxAge:60000}}); 

                    console.log("menno was hier");
   /*                 Step(
                        function(){
                            db.set("sit",{bla:5},this);
                        },
                        function(){
                            db.set("sit",{bla:"bla",sef:9},this);
                        },
                        function(){
                            db.get("sit",function(err, res){
                                console.log("got res:");
                                console.log(res);
                            });
                        }
                    );
                    */
                    //db = Databank.get("memory", {});

                    /*db.connect({}, function(err) {
                        var store;
            
                        if (err) {
                            callback(err, null);
                        } else {
                            try {
                                store = new DatabankStore(db);
                                callback(null, store, db);
                            } catch (e) {
                                callback(e, null, null);
                            }
                        }
                    });
                    */
                    process.nextTick(function(){
                        callback(null, store, db);
                    });
    
                },
                teardown: function(store, db) {
                    console.log("in main teardown");
                    //console.log(app);
                    /*
                    if (db && db.disconnect) {
                        db.disconnect(function(err) {});
                        db.store.close();
                    }
                    */
                },
                "it works": function(err, store, db) {
                    assert.ifError(err);
                    assert.isObject(store);
                    assert.isObject(db);
                },
		"and we start an app using the store": {
		    topic: function(store) {
			var cb = this.callback,
			    app = connect();

            console.log(store);
			app.use(session({
                secret: "test", 
                saveUninitialized:true, 
                resave: false, 
                cookie:{expires: false}, 
                magAge: 30000,
                store: store}));
			//app.use(session({secret: "test", saveUninitialized:true, resave: false }));

			app.use(function(req, res) {
			    var cb;
//                console.log(req.session);
			    req.session.lastUrl = req.originalUrl;
                console.log("session stuff");
			    if (req.session.hits) {
                    req.session.hits++;
			    } else {
                    req.session.hits = 1;
			    }
			    res.end("Hello, world! :"+req.session.hits);
			    // Leak the session out the side door
			    if (app.callback) {
                    cb = app.callback;
                    process.nextTick(function() {
                        cb(null, req.session);
                    });
			    }
			});
            server = http.createServer(app).listen(1516, function(){
			//app.listen(1516, function() {
			    cb(null, app) ;
			});
		    },
            teardown:function(app){
                console.log("in intermediate teardown");
                console.log(app);
                server.close();
               
            },
		    "it works": function(err, app) {
			assert.ifError(err);
			assert.ok(app);
		    },
		    "and we browse around the app with a few browsers": {

                        topic: function(app, store) {

                            var callback = this.callback,
                                MAXBROWSERS = 100, //was 100
                                MAXACTIONS = 20,
                                MAXPAGE = 10000,
                                counts = [],
                                lasts = [],
                                i, j, k,
                                sidOf = function(br) {
                                    var objs = br.cookies.select("connect.sid");
                                    if (!objs || objs.length === 0) {
                                        return null;
                                    } else {
                                        console.log(objs[0]);
                                        console.log(decodeURIComponent(objs[0].value).substr(2, 32));
                                        return decodeURIComponent(objs[0].value).substr(2, 32); //was 24
                                    }
                                },
                               /* 
                                wanderAround = function(br, id, pagesLeft, callback) {
                                    var p = Math.floor(Math.random() * MAXPAGE),
                                        oldSid = sidOf(br);
                                    
                                    console.log("p:"+p);
                                    
                                    br.visit("http://localhost:1516/"+p, function(err) {
                                        console.log("back from visit url");
                                        store.get(oldSid, function(err, dat){
                                            console.log(br.html());
                                            console.log("huh:"+dat.hits);
                                        });

                                        if (err) {
                                            console.log("err");
                                            callback(err, null);
                                        } else if (pagesLeft == 1) {
                                            lasts[id] = p;
                                            console.log("last page");
                                            callback(null, br);
                                        } else if (oldSid && sidOf(br) != oldSid) {
                                            callback(new Error("SID of browser changed from " + oldSid + " to " + sidOf(br)));
                                        } else {
                                            console.log("wanderingAround again...");
                                            wanderAround(br, id, pagesLeft - 1, callback);
                                        }
                                    });
                                }
                                */
                                    
                                wanderAround = function (br, id, pagesLeft , callback){
                                    var p = Math.floor(Math.random() * MAXPAGE),
                                        oldSid = sidOf(br);
                                    console.log("wandering..."+pagesLeft+" sid:"+oldSid);

                                    Step(
                                        function(){
                                            console.log("visit..");
                                            br.visit("http://localhost:1516/"+p, this);
                                        },
                                        function(err){
                                            console.log("back from visit");
                                            console.log(br.html());
                                            if (err) {
                                                console.log("err:"+err);
                                                callback(err, null);
                                            } else if (pagesLeft == 1){
                                                lasts[id] = p;
                                                callback(null, br);
                                            } else if (oldSid && sidOf(br) != oldSid){
                                                callback(new Error("SID of browser changed from " +oldSid + " to " + sidOf(br)));
                                            } else {
                                                console.log("gonna go recursive");
                                                wanderAround(br, id, pagesLeft - 1, callback);
                                            }
                                        }
                                    );
                                }

                            Step(
                                function() {
                                    var group = this.group(),
                                        i;
                                        //br = new Browser();

                                    //br.debug();
                                    for (i = 0; i < MAXBROWSERS; i++) {
                                        var br = new Browser({waitDuration: 30*1000});
                                        counts[i] = 10 + Math.floor(Math.random()*20);
                                        console.log("wanderingAround:"+counts[i]);
                                        wanderAround(br, i, counts[i], group());
                                    }
                                },
                                function(err, browsers, ps) {
                                    var group = this.group();
                                    if (err) throw err;
                                    console.log("All browsers back from wandering");
                                    _.each(browsers, function(br) {
                                        var sid = sidOf(br);
                                        store.get(sid, group());
                                    });
                                },
                                function(err, sessions ) {
                                    console.log(store.store.locker);
                                    if (err) {
                                        callback(err);
                                    } else {
                                        callback(err, lasts, counts, sessions);
                                    }
                                }
                            );
                        },
                        "it works": function(err, lasts, counts, sessions) {
                            assert.ifError(err);
                            console.log("hmmm it works");
                        },
                        "session data is correct": function(err, lasts, counts, sessions) {
                            var i;
                            assert.ifError(err);
                            console.log("last test");
                            for (i = 0; i < sessions.length; i++) {
                                console.log(sessions[i]);
                                assert.equal(sessions[i].hits, counts[i]);
                                assert.equal(sessions[i].lastUrl, "/"+lasts[i]);
                            }
                        }
		    }
	        }
	    }
        }
    }
});

suite["export"](module);
