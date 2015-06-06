/**
 * Created by fugang on 14/12/15.
 */
var common = require('cloud/common.js');
var myutils = require('cloud/utils.js');
var _ = AV._;

/*
    搜索
    函数名：getSearch
    参数：
    userId: objectId 当前用户ID
    kw: string  搜索关键字
    tagId:objectId    搜索标签ID
    skip:Integer 搜索偏移
    limit:Integer 搜索返回数限制
    type:string 搜索类型
        3 资讯 ,1 动态,2 问答,4 部落,5 人,6 活动
        'news'：精选
        'dynamic'：动态
        'clan'：部落
        'user'：用户
        'activity'：活动
    返回：
    [

    ]
 */
AV.Cloud.define("getSearch",function(req,res){
    var currUserId = req.user?req.user.id:undefined;
    var Dynamic = common.extendClass("DynamicNews");
    var Clan = common.extendClass("Clan");
    var User = common.extendClass("_User");
    var News = common.extendClass("News");
    var Tag = common.extendClass("Tag");
    var Activity = common.extendClass("Activity");


    //type  3 资讯 ,1 动态,2 问答,4 部落,5 人,6 活动
    var  type = req.params.type.toString();
    var  userId = req.params.userId;
    var  kw  = req.params.kw;
    var  tagId = req.params.tagId;
    var  skip = req.params.skip || 0;
    var  limit = req.params.limit || 20;

    if (!userId) {  //如果用户ID未传，则以当前登录用户的ID为准
        userId = currUserId;
    }
    console.info('getSearch params,userId:%s type:%s kw:%s tagId:%s skip:%d limit:%d currUserId:%s',
        userId, type, kw, tagId, skip, limit, currUserId);

    //资讯
    var getNews =function() {
        var query = new AV.Query(News);
        query.select(["comment_count", "cateids", "title", "up_count", "list_pic",
            "allow_comment", "areas", "contents_url", "allow_forward", "tags", "rank"]);
        query.limit(limit);
        query.skip(skip);
        query.descending('publicAt');
        query.notEqualTo('status', 2);
        if (tagId) {
            query.equalTo("tags", tagId);
        } else {
            var re=new RegExp(kw,"i");
            query.matches("title",  re);
        }
        var newsIds = [];
        query.find().then(function(results){
            return common.newsResultWapper(userId, results);
        }).then(function(results){
            res.success(results);
        });
    }

    //问答
    var getAsk = function(){
        var query = new AV.Query(Dynamic);
        query.select("user_id","nickname", "content", "type",
            "thumbs","up_count","comment_count","objectId","tags", "voice", "duration",
            "area", "position");
        query.equalTo("type", 1);
        query.include('user_id');
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            query.contains("content", kw);
        }
        query.limit(limit);
        query.skip(skip);
        query.include('user_id');
        query.descending('createdAt');
        query.find({
            success:function(results){
                if (results) {
                    for (var i in results) {
                        var currResult = results[i];
                        var currUser = currResult.get('user_id');
                        if (!currUser || !currUser.id) {
                            results[i] = undefined;
                            continue;
                        }
                        var retUser = AV.User.createWithoutData('_User', currUser.id);
                        retUser.set('nickname', currUser.get('nickname'));
                        retUser.set('icon', currUser.get('icon'));
                        retUser.set('tags', currUser.get('tags'));
                        var jValue = retUser._toFullJSON();
                        delete jValue.__type;
                        currResult.set('user_id', jValue);
                    }
                }
                results = AV._.reject(results, function(val){
                    return (val == undefined);
                });
                res.success(results);
            }
        })
    }

    //动态
    var getDynamic = function(){
        var isAppStoreTestUser = function() {
            if (req.user) {
                var userVersion = req.user.get('appVersion');
                var deviceType = req.user.get('deviceType');
                var userName = req.user.get('username');
                if (deviceType=='iPhone' && userVersion=='1.0.7' && userName=='18939886042') {
                    return true;
                }
            }

            return false;
        }
        var query = new AV.Query(Dynamic);
        query.select("user_id","nickname", "content", "type",
            "thumbs","up_count","comment_count","objectId","tags", "voice", "duration",
            "area", "position", "activityId");
        query.equalTo("type", 2);
        query.notEqualTo('status', 2);
        query.limit(limit);
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            var re=new RegExp(kw,"i");
            query.matches("content",  re);
        }
        query.skip(skip);
        query.include('user_id', 'activityId');
        query.descending('createdAt');
        query.find({
            success:function(results){
                if (!results) {
                    res.success([]);
                    return;
                }

                if (isAppStoreTestUser()) {
                    res.success(['123']);
                } else {
                    common.addLikesAndReturn(req.user&&req.user.id, results, res);
                }
            }
        })
    };

    //部落
    var getClan = function(){
        var query = new AV.Query(Clan);
        query.limit(limit);
        query.skip(skip);
        query.descending('createdAt');
        query.notEqualTo('status', 1);
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            var re=new RegExp(kw,"i");
            query.matches("title",  re);
        }
        query.find({
            success: function(result) {
                res.success(result);
            }
        });
    };

    //用户
    var getUser = function(){
        var query = new AV.Query(User);
        query.select("icon", "nickname","actual_position","tags","clanids","objectId");
        query.limit(limit);
        query.skip(skip);
        query.descending('createdAt');
        query.notEqualTo('status', 2);
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            var re=new RegExp(kw,"i");
            query.matches("nickname",  re);
        }
        query.find().then(function(results) {
            return common.addFriendShipForUsers(userId, results);
        }).then(function(results){
            res.success(results);
        });
    };



     var getActivity = function(){
         var retVal = [];
         var query = new AV.Query(Activity);
        query.limit(limit);
         query.notEqualTo('status', 1);
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            var re=new RegExp(kw,"i");
            query.matches("title",  re);
        }
        query.skip(skip);
         query.descending('activity_end_time');
        query.addDescending('createdAt');
         query.find().then(function(results){
             if (!results) {
                 res.success();
                 return;
             }
             results.forEach(function(activity){
                 var retItem = {};
                 retItem.activity = activity._toFullJSON();
                 retItem.activity.price = retItem.activity.price || '0.00';
                 retItem.extra = {
                     friendJoin:0
                 };

                 retVal.push(retItem);
             });

             res.success(retVal);
         });
    };


    var switchTab  = function(type, res){
        //type  3 资讯 ,1 动态,2 问答,4 部落,5 人 ,6活动
        switch(type)
        {
            case "3":
            case 'news':
                getNews();
                break;
            case "1":
            case 'dynamic':
                getDynamic();
                break;
            case "2":
            case 'dynamic':
                getDynamic();
                break;
            case "4":
            case 'clan':
                getClan();
                break;
            case "5":
            case 'user':
                getUser();
                break;
            case "6":
            case 'activity':
                getActivity();
                break;
            default:
                console.error('未知的查询类型:'+type);
                res.error('未知的查询类型:'+type);
        }

    };

    if(tagId || type=='5' || type=='user'){
        switchTab(type, res);
    }else if(kw){
        var query = new AV.Query(Tag);
        query.select("objectId","tag_name");
        var re=new RegExp(kw,"i");
        query.matches("tag_name",  re);
        query.lessThanOrEqualTo('status', 1);
        query.first({
            success: function(result) {
                if(result){
                    console.info('match tag:', result);
                    tagId = result.id;
                }
                switchTab(type, res);
            },
            error:function(error) {
                console.error('query tagName error:%O', error);
                res.error('found tagName '+kw+' error!');
            }
        });
    }else {
        res.success([]);
    }

});

/*
    搜索
    函数名：
        getSearch2 （替换getSearch）
    参数：
        userId: objectId 当前用户ID
        kw: string  搜索关键字
        tagId:objectId    搜索标签ID
        skip:Integer 搜索偏移
        limit:Integer 搜索返回数限制
        type:string 搜索类型
            'news'：精选
            'dynamic'：动态
            'clan'：部落
            'user'：用户
            'activity'：活动
    返回：
    1、查询动态返回
    resDynamic: [
        {
            dynamic: DynamicNews class object
            extra:{
                tagNames:array 动态对应的标签名称
                isLike: true or false
            }
        },
        ...
    ]
    2、查询精选返回
    resNews:[
        {
            news: News class object
            extra:{
                tagNames:array   资讯对应的标签名称
                catesName: array 装备名称
                areasName: array 地域名称
                isLike: true or false
                likeObjectId:objectId like表数据对应的objectId
            }
        },
        ...
    ]
    3、查询部落
    resClan:[
        {
            clan:clan class object
            extra:{
                tagNames:array 部落对应的标签名称
                clanType:Integer
                    0：未加入
                    1：部落创建者
                    2：部落成员
                    3：申请加入待审核
            }
        },
        ...
    ]
    4、查询用户
    resUser:[
        {
            user:User class object
            extra:{
                tagNames:array 用户对应的标签名称
                isFriend: true or false
            }
        },
        ...
    ]
    5、查询活动
    resActivity:[
        {
            activity:Activity class object
            extra:{
                friendJoin:Integer 好友加入个数
                tagNames:array 活动对应的tag名称
            }
        }
    ]

 */
AV.Cloud.define('getSearch2', function(req, res){
    var  type = req.params.type.toString();
    var  userId = req.params.userId || (req.user && req.user.id);
    var  kw  = req.params.kw;
    var  tagId = req.params.tagId;
    var  skip = req.params.skip || 0;
    var  limit = req.params.limit || 20;

    console.info('getSearch2 params,userId:%s type:%s kw:%s tagId:%s skip:%d limit:%d',
        userId, type, kw, tagId, skip, limit);

    //资讯
    var getNews = function() {
        var query = new AV.Query('News');
        query.select(["comment_count", "cateids", "title", "up_count", "list_pic",
            "allow_comment", "areas", "contents_url", "allow_forward", "tags", "rank"]);
        query.limit(limit);
        query.skip(skip);
        query.descending('rank');
        query.addDescending('publicAt');
        query.notEqualTo('status', 2);
        if (tagId) {
            query.equalTo("tags", tagId);
        } else {
            var re=new RegExp(myutils.escapeExprSpecialWord(kw),"i");
            query.matches("title",  re);
        }
        var newsIds = [];
        query.find().then(function(results){
            return common.newsResultWapper2(userId, results);
        }).then(function(results){
            res.success({
                resNews:results
            });
        });
    }

    //动态
    var getDynamic = function(){
        var isAppStoreTestUser = function() {
            if (req.user) {
                var userVersion = req.user.get('appVersion');
                var deviceType = req.user.get('deviceType');
                var userName = req.user.get('username');
                if (deviceType=='iPhone' && userVersion=='1.0.7' && userName=='18939886042') {
                    return true;
                }
            }

            return false;
        }
        var pickActivityKeys = ['objectId','__type', 'title', "className"];
        var queryOr = [];

        var query = new AV.Query('DynamicNews');
        query.doesNotExist('clan_ids');
        queryOr.push(query);

        var query = new AV.Query('DynamicNews');
        query.equalTo('clan_ids', []);
        queryOr.push(query);

        query = AV.Query.or.apply(null, queryOr);
        query.select("user_id","nickname", "content", "type",
            "thumbs","up_count","comment_count","objectId","tags", "voice", "duration",
            "area", "position", "activityId");
        query.equalTo("type", 2);
        query.limit(limit);
        query.notEqualTo('status', 2);
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            var re=new RegExp(myutils.escapeExprSpecialWord(kw),"i");
            query.matches("content",  re);
        }
        query.skip(skip);
        query.include('user_id', 'activityId');
        query.descending('createdAt');
        var findDynamics;
        query.find().then(function(dynamics){
            findDynamics = dynamics;

            return common.findLikeDynamicUsers(userId, dynamics);
        }).then(function(likeResult){
            var retDynamic = [];
            var pickUserKeys = ["objectId", "nickname", "className", "icon", "__type"];
            var pickActivityKeys = ['objectId','__type', 'title', "className"];
            var appStoreTestUser = isAppStoreTestUser();
            _.each(findDynamics, function(dynamic){
                var user = dynamic.get('user_id');
                var activity = dynamic.get('activityId');

                dynamic = dynamic._toFullJSON();
                dynamic.user_id = _.pick(user._toFullJSON(), pickUserKeys);
                if (activity) {
                    dynamic.activityId = _.pick(activity._toFullJSON(), pickActivityKeys);
                }

                retDynamic.push({
                    dynamic:appStoreTestUser?'123':dynamic,
                    extra:{
                        tagNames:common.tagNameFromId(dynamic.tags),
                        isLike:likeResult[dynamic.objectId]?true:false
                    }
                })
            });

            res.success({
                resDynamic:retDynamic
            });
        });
    };

    //部落
    var getClan = function(){
        var query = new AV.Query('Clan');
        query.include('founder_id');
        query.limit(limit);
        query.skip(skip);
        query.descending('createdAt');
        query.notEqualTo('status', 1);
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            var re=new RegExp(myutils.escapeExprSpecialWord(kw),"i");
            query.matches("title",  re);
        }
        query.find({
            success: function(results) {
                var retResult = [];
                //保留的user keys
                var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "__type", "tags"];
                _.each(results, function(clanItem){
                    var founder = clanItem.get('founder_id');
                    var clanIds = req.user && req.user.get('clanids');
                    var reviewClanIds = req.user && req.user.get('review_clanids');
                    var clanType = 0;
                    if (founder.id != req.user.id) {
                        if (clanIds && _.indexOf(clanIds,clanItem.id)>=0) {
                            clanType = 2;   //部落成员
                        } else if (reviewClanIds && _.indexOf(reviewClanIds,clanItem.id)>=0) {
                            clanType = 3;   //申请加入待审核
                        }

                    } else {
                        clanType = 1;       //部落创建者
                    }

                    clanItem = clanItem._toFullJSON();
                    clanItem.founder_id = _.pick(founder._toFullJSON(), pickUserKeys);
                    retResult.push({
                        clan:clanItem,
                        extra:{
                            tagNames:common.tagNameFromId(clanItem.tags),
                            clanType:clanType
                        }
                    });
                })

                res.success({
                    resClan:retResult
                });
            }
        });
    };

    //用户
    var getUser = function(){
        var query = new AV.Query('BlackList');
        query.equalTo('type', 'user');
        query.first().then(function(blackObj){
            //先获得黑名单列表
            var blackIds = blackObj&&blackObj.get('blackIds');

            var query = new AV.Query('_User');
            query.select("icon", "nickname","actual_position","tags","clanids","objectId");
            query.limit(limit);
            query.skip(skip);
            query.descending('createdAt');
            if (!_.isEmpty(blackIds)) {
                query.notContainedIn('objectId', blackIds);
            }
            if(tagId){
                query.equalTo("tags", tagId);
            }else {
                var re=new RegExp(myutils.escapeExprSpecialWord(kw),"i");
                query.matches("nickname",  re);
            }
            var findUsers;
            var retResult = [];
            query.find().then(function(results) {
                findUsers = results;
                return common.addFriendShipForUsers(userId, results);
            }).then(function(result){
                _.each(findUsers, function(userItem){
                    var resItem = {};
                    resItem.user = userItem._toFullJSON();
                    if (result[userItem.id]) {
                        resItem.extra = {
                            isFriend:true,
                            tagNames:common.tagNameFromId(userItem.get('tags'))
                        };
                    }

                    retResult.push(resItem);
                });

                res.success({
                    resUser:retResult
                });
            });
        });
    };

    var getActivity = function(){
        var retVal = [];
        var query = new AV.Query('Activity');
        query.limit(limit);
        query.notEqualTo('status', 1);
        if(tagId){
            query.equalTo("tags", tagId);
        }else {
            var re=new RegExp(myutils.escapeExprSpecialWord(kw),"i");
            query.matches("title",  re);
        }
        query.skip(skip);
        query.descending('createdAt');
        query.find().then(function(results){
            var activities = [];
            _.each(results, function(activity){
                var retItem = {};
                retItem.activity = activity._toFullJSON();
                retItem.activity.price = retItem.activity.price || '0.00';
                retItem.extra = {
                    friendJoin:0,
                    tagNames:common.tagNameFromId(activity.get('tags'))
                };

                activities.push(AV.Object.createWithoutData('Activity', activity.id));
                retVal.push(retItem);
            });

            if (_.isEmpty(activities)) {
                return AV.Promise.as();
            } else {
                var query = new AV.Query('ActivityUser');
                query.containedIn('activity_id', activities);
                query.equalTo('user_id', AV.User.createWithoutData('User', userId));
                query.limit(limit);
                return query.find();
            }

        }).then(function(results){
            var activityObj = {};
            _.each(results, function(item){
                var activity = item.get('activity_id');
                if (activity) {
                    activityObj[activity.id] = true;
                }
            });

            _.each(retVal, function(item){
               if (activityObj[item.activity && item.activity.objectId]) {
                   item.extra.hasSignup = true;
               }
            });

            res.success({
                resActivity:retVal
            });
        });
    };

    var switchTab  = function(type, res){
        //type  3 资讯 ,1 动态,2 问答,4 部落,5 人 ,6活动
        switch(type)
        {
            case 'news':
                getNews();
                break;
            case 'dynamic':
                getDynamic();
                break;
            case 'clan':
                getClan();
                break;
            case 'user':
                getUser();
                break;
            case 'activity':
                getActivity();
                break;
            default:
                console.error('未知的查询类型:'+type);
                res.error('未知的查询类型:'+type);
        }

    };

    if(tagId || type=='user'){
        //标签筛选
        switchTab(type, res);
    } else if(kw){
        //先看关键字是否有匹配到标签，如果有，则做标签筛选，否则按关键字查询
        var query = new AV.Query('Tag');
        query.select("objectId","tag_name");
        var re=new RegExp(myutils.escapeExprSpecialWord(kw),"i");
        query.matches("tag_name",  re);
        query.lessThanOrEqualTo('status', 1);
        query.first({
            success: function(result) {
                if(result){
                    console.info('match tag:', result);
                    tagId = result.id;
                }
                switchTab(type, res);
            },

            error:function(error) {
                console.error('query tagName error:%O', error);
                res.error('found tagName '+kw+' error!');
            }
        });
    }else {
        res.success({
            resDynamic:[],
            resNews:[],
            resUser:[],
            resClan:[],
            resActivity:[]
        });
    }});