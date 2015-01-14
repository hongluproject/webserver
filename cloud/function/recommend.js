

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
    var selfFriendsObj=[];

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
            query.notContainedIn('user_id', selfFriendsObj);
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
                    var outChannel = {};
                    outChannel       = result[i];

                    //遍历user_id，去掉不需要返回的字段，减少网络传输
                    var user =  outChannel.get("user_id");
                    if (!user || !user.id) {
                        continue;
                    }
                    var rawUser = user;
                    if (rawUser && rawUser.id) {
                        var postUser = AV.Object.createWithoutData('_User', rawUser.id);
                        postUser.set('icon', rawUser.get('icon'));
                        postUser.set('nickname', rawUser.get('nickname'));
                        var jValue = postUser._toFullJSON();
                        delete jValue.__type;
                        outChannel.set('user_id', jValue);
                    }

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
            query.notContainedIn('user_id', selfFriendsObj);
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

                    //遍历user_id，去掉不需要返回的字段，减少网络传输
                    var user =  outChannel.get("user_id");
                    if (!user || !user.id) {
                        continue;
                    }
                    var rawUser = user;
                    if (rawUser && rawUser.id) {
                        var postUser = AV.Object.createWithoutData('_User', rawUser.id);
                        postUser.set('icon', rawUser.get('icon'));
                        postUser.set('nickname', rawUser.get('nickname'));
                        var jValue = postUser._toFullJSON();
                        delete jValue.__type;
                        outChannel.set('user_id', jValue);
                    }

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
                for (var i = 0; result && i < result.length; i++) {
                    selfFriendsObj.push(AV.User.createWithoutData('_User', result[i].get("followee").id));
                    selfFriends.push(result[i].get("followee").id);
                }
                var query = new AV.Query(User);
                query.first(userid).then(function(result){
                    getRecommendUserPublic(result);

                });
            });
        }else{
            getRecommendUserPublic(null);
        }
    }
    //封装
    var  getRecommendUserPublic = function(userObj){
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
                    result[i].attributes.indexTagId = tags[index];
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
