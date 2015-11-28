//menno store 
//
//

var util = require("util"),
    _ = require("underscore");

function MStore(){
   this.locker=[];

   console.log("MSTORE CREATED");
}

MStore.prototype.get = function (sid, fn){
    var res = _.where(this.locker, { "sid": sid})[0];//should be only one
    //console.log("MStore.get:");
//    console.log(res);
  //  if(res.cookie){
   //     res.cookie.expires=res.cookie._expires;
   // }
 //   console.log(res);
    fn(null, res);
}

MStore.prototype.set = function (sid, obj, fn){
    var res = _.where(this.locker, { "sid": sid})[0];
    
    if(res){
        console.log("set already got ses");
        res.obj = obj;
    } else {
        console.log("set new sess");
        //set cookie.expires
        //new Date(Date.now() + hour)
        this.locker.push({"sid":sid,obj:obj});
    }

    //console.log(this.locker);
   //j console.log(this.locker.cookie);
    //console.log(fn.toString());
    return fn(null, arguments);
}

MStore.prototype.getAll = function(){
    return this.locker;
}

module.exports.MStore = MStore;



module.exports.Store = function(session){

    var Store = session.Store;
    
    
   /*****************************************
    * description
    *
    *   CONNECT STUF 
    ****************************************/ 
    function MConnect(options) {
        var self = this;

        this.store=options.db;
//        console.log("MCONNECT CREATED");
        
        Store.call(this, options);
        console.log(self);
    }

    util.inherits(MConnect, Store);

    MConnect.prototype.get = function (sid, fn){
        var self = this;
 //       console.log("MCONNECT.get:");
        
        self.store.get(sid,function(err,res){
    //        console.log("MConnect:");
     //       console.log(res);
      //      console.log("-------");
            return fn(null, res.obj);
            //fn(null,res);
        });
    };

    MConnect.prototype.set = function (sid, obj, fn){
        var self = this;

 //       console.log("MConnect.set:");
//        console.log(obj);
  //      console.log("store.cookie");
   //     console.log(self.store.cookie);
        self.store.set(sid,obj,function(err){
            return fn(err);
        })
    };

    return MConnect;

}
