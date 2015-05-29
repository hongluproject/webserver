

/**
 * Created by fugang on 14/12/12.
 */
var common = require('cloud/common');
var _ = AV._;

/*
    推荐
 函数名
 getRecommend2 （用于替换getRecommend）
 参数：
 recommendType:string 推荐类型
           user    推荐用户
 userId: objectId 用户ID
 tags: array 用户标签，若为当前登陆用户，可不传
 skip、limit:翻页查询参数
 返回：[
         {
             user: user class object
             dynamics: 用户最近发布的带图片的动态
             [
                dynamic class object
             ]
         }
     ]
 */
AV.Cloud.define('getRecommend2', function(req, res){
    var userId = req.params.userId || (req.user && req.user.id);
    var tags = req.params.tags || (req.user && req.user.get('tags'));
    var recommendType = req.params.recommendType || 'user';
    var skip = req.params.skip || 0;
    var limit = req.params.limit || 20;

    if (!userId || !tags) {
        res.success([]);
        return;
    }

    console.info('user tags %s', tags);

    var retVal = [];
    var excludeIds = [userId];
    var promises = [];

    var query = new AV.Query('_Followee');
    query.select('followee');
    query.equalTo('user', AV.User.createWithoutData('_User', userId));
    query.limit(1000);
    promises.push(query.find());

    var query = new AV.Query('BlackList');
    query.equalTo('type', 'user');
    promises.push(query.first());
    AV.Promise.when(promises).then(function(results, blackObj){
        _.each(results, function(followee){
            excludeIds.push(followee.get('followee').id);
        });

        var queryOr = [];
        _.each(tags, function(tag){
            var query = new AV.Query('_User');
            query.equalTo('tags', tag);
            query.exists('tags');
            queryOr.push(query);
        });

        var blackIds = blackObj&&blackObj.get('blackIds');
        var queryUser = AV.Query.or.apply(null, queryOr);
        queryUser.notContainedIn('objectId', excludeIds);
        if (!_.isEmpty(blackIds)) {
            queryUser.notContainedIn('objectId', blackIds);
        }
        queryUser.skip(skip);
        queryUser.limit(limit);
        queryUser.descending('createdAt');
        return queryUser.find();
    }).then(function(users){
        _.each(users, function(user){
           retVal.push({
               user: user._toFullJSON()
           });
        });

        res.success(retVal);
    });


});

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
        recommendDynamic:{}
    };
    var getRecommendAsk = function(){
        var query = new AV.Query(Dynamic);
        query.select("user_id","content", "type","thumbs","up_count","comment_count","objectId","tags","share_url");
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
        query.select("user_id","content", "type","thumbs","up_count","comment_count","objectId","tags","share_url");
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
        query.include('user_id', 'activityId');
        query.find({
            success:function(dynamicResults){
                common.addLikesAndReturn(userid, dynamicResults).then(function(results){
                    ret.recommendDynamic = results;
                    res.success(ret);
                })
            },
            error:function(){
                ret.recommendDynamic = [];
                res.success(ret);
            }
        })
    }


    var  getRecommendUser = function(){
        if(userid){
            var query = new AV.Query(Followee);
            query.select('followee');
            query.equalTo('user',AV.User.createWithoutData('_User', userid));
            query.limit(1000);
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

/** 获取推荐的活动
 * 函数名：getRecommendActivity
 * 参数：{
 *  userId:用户ID，若未当前登陆用户，可不传
 *  tags:用户所关注标签，若未当前登陆用户，可不传
 * }
 * 返回：
 * [{ActivityRecommend 1, ActivityRecommend 2,...}]
 */
AV.Cloud.define('getRecommendActivity', function(req, res){
    var userId = req.params.userId;
    if (!userId && req.user && req.user.id) {
        userId = req.user.id;
    }
    var tags = req.params.tags;
    if (!tags && req.user) {
        tags = req.user.get('tags');
    }

    var retVal = [];
    var query = new AV.Query('ActivityRecommend');
    query.lessThan('status', 1); //小于1表示出于上线状态
    query.include('activityId');
    query.limit(5);
    query.descending('updatedAt');
    query.find().then(function(results){
        if (!results) {
            res.success();
            return;
        }

        results.forEach(function(item){

            var activity = item.get('activityId');
            item = item._toFullJSON();
            item.activityId = activity._toFullJSON();

            retVal.push(item);
        });

        res.success(retVal);
    }, function(err){
        console.error('getRecommendActivity error:', err);
        res.error('查询推荐活动失败，错误码:'+err.code);
    });
});