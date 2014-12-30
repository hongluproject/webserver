AV.Cloud.define("getClan",function(req, res){
    var HPGlobalParam = AV.HPGlobalParam || {};
    var userid = req.params.userid;
    var tags = req.params.tags;
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
                            var arrayTagName = [];
                            var arrayTag = result[i].get('tags');
                            for (var k in arrayTag) {
                                var name = '';
                                if (HPGlobalParam.hpTags[arrayTag[k]]) {
                                    name = HPGlobalParam.hpTags[arrayTag[k]].get('tag_name');
                                }
                                arrayTagName.push(name);
                            }
                            if (arrayTagName.length) {
                                result[i].set('tagsName', arrayTagName);
                            }
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

        },function(error) {
            ret.selfClan = userClan=[];
            getRecommendClan ();
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
                    var arrayTagName = [];
                    var arrayTag = result[i].get('tags');
                    for (var k in arrayTag) {
                        var name = '';
                        if (HPGlobalParam.hpTags[arrayTag[k]]) {
                            name = HPGlobalParam.hpTags[arrayTag[k]].get('tag_name');
                        }
                        arrayTagName.push(name);
                    }
                    if (arrayTagName.length) {
                        result[i].set('tagsName', arrayTagName);
                    }
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


