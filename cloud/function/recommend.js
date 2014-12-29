

/**
 * Created by fugang on 14/12/12.
 */


AV.Cloud.define("getRecommend",function(req, res){
    //共用
    var tags = req.params.tags;
    if (!tags || tags.length <=0) {
        res.error('tags not found!');
        return;
    }
    var index = Math.floor((Math.random()*tags.length));
    var userid = req.params.userid;
    var User = AV.Object.extend("_User");
    var Clan = AV.Object.extend("Clan");
    var Dynamic = AV.Object.extend("DynamicNews");
    var Followee = AV.Object.extend("_Followee");
    var selfFriends = [];

    var ret = {
        recommendUser:{},
        recommendDynamic:{},
        recommendAsk:{}
    };
    var getRecommendAsk = function(){
        var query = new AV.Query(Dynamic);
        query.select("user_id","content", "type","thumbs","up_count","comment_count","objectId","tags");
        query.equalTo("tags", tags[index]);
        query.equalTo("type", 1);
        if(userid) {
            query.notEqualTo('user_id', AV.User.createWithoutData('_User', userid));
            query.notContainedIn('user_id', selfFriends);
        }

        //30天
        var today=new Date();
        var t=today.getTime()-1000*60*60*24*30;
        var searchDate=new Date(t);
        query.greaterThan('createdAt',searchDate);
        query.limit(2);
        query.descending("up_count");
        query.include('user_id');
        query.find({
            success:function(result){
                var askResult = [];
                for (var i = 0; result && i < result.length; i++) {
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
        if(userid) {
            query.notEqualTo('user_id', AV.User.createWithoutData('_User', userid));
            query.notContainedIn('user_id', selfFriends);
        }
        var today=new Date();
        var t=today.getTime()-1000*60*60*24*30;
        var searchDate=new Date(t);
        query.greaterThan('createdAt',searchDate);
        query.limit(2);
        query.descending("up_count");
        query.include('user_id');
        query.find({
            success:function(result){
                var dynamicResult = [];
                for (var i = 0; result && i < result.length; i++) {
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


    var  getRecommendUser = function(){
        if(userid){
            var query = new AV.Query(Followee);
            query.select('followee');
            query.equalTo('user',AV.User.createWithoutData('_User', userid));
            query.find().then(function(result){
                var selfFriends = [];
                for (var i = 0; result && i < result.length; i++) {
                    selfFriends.push(result[i].get("followee").id);
                }
                var query = new AV.Query(User);
                query.first(userid).then(function(result){
                    getRecommendUserPublic(selfFriends,result);

                });
            });
        }else{
            getRecommendUserPublic(null,null);
        }
    }
    //封装
    var  getRecommendUserPublic = function(selfFriends,userObj){
        var query = new AV.Query(User);
        query.select("icon", "nickname","actual_position","tags","clanids","objectId");
        if(userObj){
            //距离
            var userGeoPoint = userObj.get("actual_position");
            query.near("actual_position", userGeoPoint);
        }
        if(userid){
            //非自己
            query.notEqualTo("objectId", userid);
        }
        query.equalTo("tags", tags[index]);
        if(selfFriends){
            query.notContainedIn("objectId", selfFriends);
        }
        query.limit(2);
        query.find({
            success: function(result) {
                var userResult = [];
                for (var i = 0; result && i < result.length; i++) {
                    var outChannel = {};
                    outChannel       = result[i];
                    userResult.push(outChannel);
                }
                ret.recommendUser = userResult;
                getRecommendDynamic();
            },
            error:function(){
                ret.recommendUser = [];
                getRecommendDynamic();
            }
        });
    }
    getRecommendUser();
});
