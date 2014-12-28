AV.Cloud.define("getClan",function(req, res){
    var userid = req.params.userid;
    var User = AV.Object.extend("_User");
    var Clan = AV.Object.extend("Clan");
    var ret = {
        selfClan:{},
        recommendClan:{}
    };
    var getSelfClan = function(userid){
        var query = new AV.Query(User);
        query.select("nickname","tags","clanids");
        query.get(userid).then(function(result) {
            var  clanids = result.get("clanids");
            if(clanids){
                var query = new AV.Query(Clan);
                query.containedIn("objectId",clanids);
                query.find({
                    success: function(result) {
                        var userClan = [];
                        for (var i = 0; i < result.length; i++) {
                            var outResult = {};
                            outResult       = result[i];
                            userClan.push(outResult);
                        }
                        ret.selfClan = userClan;
                        getRecommendClan (clanids);
                     }
                });
            }else{
                ret.selfClan = userClan=[];
                getRecommendClan (clanids);
            }

        });
    }

    var getRecommendClan = function (clanids){
        var query = new AV.Query(Clan);
        query.limit(2);
        query.notContainedIn("objectId",clanids);
        query.find({
            success: function(result) {
                var recommendClan = [];
                for (var i = 0; i < result.length; i++) {
                    var outResult = {};
                    outResult       = result[i];
                    recommendClan.push(outResult);
                }
                ret.recommendClan = recommendClan;
                res.success(ret);
            }
        });

    }

    getSelfClan(userid);
});


