var clanParam = require('cloud/common.js').clanParam;

AV.Cloud.define("getClan",function(req, res){
    var HPGlobalParam = AV.HPGlobalParam || {};
    var userid = req.params.userid;
    var tags = req.params.tags||[];
    var index = Math.floor((Math.random()*tags.length));
    var User = AV.Object.extend("_User");
    var Clan = AV.Object.extend("Clan");
    var userInfo = null;
    var ret = {
        selfClan:{},
        recommendClan:{}
    };

    console.info('getClan params, userid:%s', userid);

    var getSelfClan = function(userid){
        var query = new AV.Query(User);
        query.select("nickname","tags","clanids","actual_position",'level');
        query.get(userid).then(function(result) {
            userInfo =  result;
            var  clanids = result.get("clanids");
            userLevel = result.get('level');
            if(clanids){
                var query = new AV.Query(Clan);
                query.containedIn("objectId",clanids);
                query.include('founder_id');
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

                            var founderObj = result[i].get('founder_id');
                            var userLevel = founderObj.get('level');
                            result[i].set('max_num', clanParam.getMaxClanUsers(userLevel));
                            outResult       = result[i];
                            userClan.push(outResult);
                        }
                        ret.selfClan = userClan;
                        getRecommendClan (clanids);
                     }
                });
            }else{
                ret.selfClan =[];
                getRecommendClan ();
            }

        },function(error) {
            ret.selfClan =[];
            getRecommendClan ();
        });
    }

    var getRecommendClan = function (clanids){
        var userGeoPoint = userInfo.get('actual_position');
        var query = new AV.Query(Clan);
        query.limit(2);
        if(clanids)
        query.notContainedIn("objectId",clanids);
        if(tags[index])
        query.equalTo("tags", tags[index]);
        if (userGeoPoint)
        query.near("position", userGeoPoint);
        query.equalTo("is_full", false);
        query.find({
            success: function(result) {
                if(result.length==0){
                    var query = new AV.Query(Clan);
                    query.limit(2);
                    if(clanids) {
                        query.notContainedIn("objectId",clanids);
                    }
                    if (userGeoPoint) {
                        query.near("position", userGeoPoint);
                    }
                    query.include('founder_id');
                    query.equalTo("is_full", false);
                    query.find({
                        success : function(result){
                        formatResult(result);
                        }
                     });
                }else{
                    formatResult(result);
                }
            }
        });
        var formatResult =function (result){
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
                var founderObj = result[i].get('founder_id');
                var userLevel = founderObj.get('level');
                result[i].set('max_num', clanParam.getMaxClanUsers(userLevel));
                recommendClan.push(outResult);
            }
            ret.recommendClan = recommendClan;
            res.success(ret);
        }
    }
    getSelfClan(userid);
});


