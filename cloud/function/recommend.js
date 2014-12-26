/**
 * Created by fugang on 14/12/12.
 */


AV.Cloud.define("getRecommend",function(req, res){
    //共用
    var tags = req.params.tags;
    var index = Math.floor((Math.random()*tags.length));
    var userid = req.params.userid;
    var User = AV.Object.extend("_User");
    var Clan = AV.Object.extend("Clan");
    var Dynamic = AV.Object.extend("DynamicNews");
    var ret = {
        recommendUser:{},
        recommendClan:{},
        recommendDynamic:{},
        recommendAsk:{}
    };
    var getRecommendAsk = function(){
        var query = new AV.Query(Dynamic);
        query.select("user_id","content", "type","thumbs","up_count","comment_count","objectId","tags");
        query.equalTo("tags", tags[index]);
        query.equalTo("type", 1);
        query.limit(2);
        query.include('user_id');
        query.find({
            success:function(result){
                var askResult = [];
                for (var i = 0; i < result.length; i++) {
                    var user =  result[i].get("user_id");
                    var outChannel = {};
                    outChannel       = result[i];
                    askResult.push(outChannel);
                }
                ret.recommendAsk = askResult;
                res.success(ret);
            },
            error:function(){
                ret.recommendAsk = [];
                res.success(ret);
            }
        })
    }


    var getRecommendDynamic = function(){
        var query = new AV.Query(Dynamic);
        query.select("user_id","content", "type","thumbs","up_count","comment_count","objectId","tags");
        query.equalTo("tags", tags[index]);
        query.equalTo("type", 2);
        query.limit(2);
        query.include('user_id');
        query.find({
            success:function(result){
                var dynamicResult = [];
                for (var i = 0; i < result.length; i++) {
                    var outChannel = {};
                    outChannel       = result[i];
                    dynamicResult.push(outChannel);
                }
                ret.recommendDynamic = dynamicResult;
                getRecommendAsk();
            },
            error:function(){
                ret.recommendDynamic = [];
                getRecommendAsk();
            }
        })
    }

    var getRecommendClan = function(userObj){
        if(userObj){
            var userGeoPoint = userObj.get("actual_position");
            var clanids        = userObj.get("clanids");
            var query = new AV.Query(Clan);
            if(clanids!=undefined){
                query.notContainedIn("objectId", clanids);
            }
            query.select("icon", "title","position","tags","objectId");
            query.equalTo("tags", tags[index]);
            query.near("position", userGeoPoint);
            query.limit(2);
            query.find({
                success: function(result) {
                    var clanResult = [];
                    for (var i = 0; i < result.length; i++) {
                        var outChannel = {};
                        outChannel       = result[i];
                        clanResult.push(outChannel);
                    }
                    ret.recommendClan = clanResult;
                    getRecommendDynamic();
                    return;
                },
                error:function(userObj,error) {
                    ret.recommendClan = [];
                    getRecommendDynamic();
                    return;
                }
            });
        }else{
            ret.recommendClan = [];
            getRecommendDynamic();
            return;
        }
    }

    var  getRecommendUser = function(){
        if(userid){
            var query = new AV.Query(User);
            query.get(userid, {
                success:function(userObj) {
                    var userGeoPoint = userObj.get("actual_position");
                    var query = new AV.Query(User);
                    query.select("icon", "nickname","actual_position","tags","clanids","objectId");
                    query.near("actual_position", userGeoPoint);
                    query.notEqualTo("objectId", userid);
                    query.equalTo("tags", tags[index]);
                    query.limit(2);
                    query.find({
                        success: function(result) {
                            var userResult = [];
                            for (var i = 0; i < result.length; i++) {
                                var outChannel = {};
                                outChannel       = result[i];
                                userResult.push(outChannel);
                            }
                            ret.recommendUser = userResult;
                            getRecommendClan(userObj);
                            return;
                        }
                    });
                },
                error:function(userObj,error) {
                    ret.recommendUser = [];
                    getRecommendClan(userObj);
                    return;
                }
            });
        }else{
            ret.recommendUser = [];
            getRecommendClan();
            return;
        }
    }
    getRecommendUser();
});
