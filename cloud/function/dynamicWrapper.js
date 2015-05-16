/**
 * Created by fugang on 14/12/12.
 */
var common = require('cloud/common');
var _ = AV._;

/*
    获取活动详情，并且返回活动信息
    函数名：
        getDynamicWithActivity
    参数:
        activityId:objectId 活动ID
        userId:object   用户ID，若不传，则为当前登录用户
        limit:Integer   本次查询返回数目
        skip:Integer    本次查询起始偏移
        getActivity:bool 是否获取活动信息
    返回：{
        activity:activity class object
        extra:{
            hasSignup:bool 是否已经报名
        }
        dynamic:[
            {
                 dynamic:DynamicNews class object
                 extra:{
                     isLike: true or false
                     tagNames: array  动态tagIds对应的名称
                 }
            }
        ]
    }
 */
AV.Cloud.define('getDynamicWithActivity', function(req, res){
    var userId = req.params.userId || (req.user && req.user.id);
    var activityId = req.params.activityId;
    var limit = req.params.limit;
    var skip = req.params.skip;
    var getActivity = req.params.getActivity || false;

    if (!activityId) {
        res.error('请传入活动信息!');
        return;
    }

    var pickActivityKeys = ['objectId','__type', 'title', "className"];
    var pickUserKeys = ['objectId','__type', 'nickname', 'username', 'icon', "className"];
    var ret = {};
    var promise = AV.Promise.as();
    promise.then(function(){
        if (getActivity) {
            var query = new AV.Query('Activity');
            query.select('-hasSignupUsers');
            query.include('user_id');
            return query.get(activityId);
        }
    }).then(function(activity){
        if (activity) {
            var user = activity.get('user_id');
            ret.activity = activity._toFullJSON();
            if (user) {
                ret.activity.user_id = _.pick(user._toFullJSON(), pickUserKeys);
            }
            var joinUsers = activity.get('joinUsers');
            if (_.indexOf(joinUsers, req.user&&req.user.id) >= 0) {
                ret.extra = {
                    hasSignup:true
                };
            }
        }
        //查询活动相关动态
        var query = new AV.Query('DynamicNews');
        query.include('user_id', 'activityId');
        query.equalTo('activityId', AV.Object.createWithoutData('Activity', activityId));
        query.equalTo('type', 2);
        query.descending('createdAt');
        query.limit(limit);
        query.skip(skip);
        return query.find();
    }).then(function(results){
        dynamics = _.reject(results, function(val){
            return (val == undefined);
        });
        return common.findLikeDynamicUsers(req.user&&req.user.id, dynamics);
    }).then(function(likeResult){
        var retDynamic = [];
        var i = 0;
        _.each(dynamics, function(dynamic){

            var userId = dynamic.get('user_id');
            var activity = dynamic.get('activityId');
            dynamic = dynamic._toFullJSON();
            if (userId) {
                dynamic.user_id = _.pick(userId._toFullJSON(), pickUserKeys);
            }
            if (activity) {
                dynamic.activityId = _.pick(activity._toFullJSON(), pickActivityKeys);
            }

            retDynamic.push({
                dynamic:dynamic,
                extra:{
                    isLike:likeResult[dynamic.objectId]?true:false,
                    tagNames:common.tagNameFromId(dynamic.tags)
                }
            });
        });
        ret.dynamic = retDynamic;

        res.success(ret);

    }).catch(function(err){
        console.error('获取活动及动态失败:', err);
        res.error('获取活动及信息失败，错误码:'+err.code);
    });
});
/*
    获取动态
    函数名：
        getDynamic2 （替换 getDynamic)
    参数：
        dynamicType:    string  查询动态类型
            followeDynamic  我关注的动态，动态首页显示内容
            mineDynamic     我的动态
            clanDynamic     归属到部落的动态
            favoriteDynamic 收藏的动态
            commentDynamic  评论过的动态
            activityDynamic 活动相关动态
            squareDynamic   广场动态
        limit:Integer   本次查询返回数目
        skip:Integer    本次查询起始偏移
        maxId:Integer   由于followeDynamic采用事件流获取，需要用maxId替换skip来获取数据
        favoriteIds:array   查询指定动态列表,在favoriteDynamic里面用到
    返回：
        [
            {
                dynamic:DynamicNews class object
                extra:{
                    isLike: true or false
                    tagNames: array  动态tagIds对应的名称
                    messageId:Integer 该动态对应的事件流ID，在动态首页中用到
                }
            }
        ]
 */
AV.Cloud.define('getDynamic2', function(req,res){
    var dynamicType = req.params.dynamicType || 'followeDynamic';	//获取的动态类型
    var userId = req.params.userId || (req.user&&req.user.id);
    var limit = req.params.limit || 20;
    var skip = req.params.skip || 0;
    var maxId = req.params.maxId || 0;
    var retDynamic = [];
    var dynamics;
    if (!userId) {
        res.error('缺少用户信息！');
        return;
    }

    var findDynamicAndReturn = function(query) {
        var pickActivityKeys = ['objectId','__type', 'title', "className"];
        var pickUserKeys = ['objectId','__type', 'nickname', 'username', 'icon', "className"];
        var msgIds;
        query.find().then(function(results){
            if (dynamicType == 'followeDynamic') {
                dynamics = [];
                msgIds = [];
                var i = 0;
                _.each(results, function(item){
                    if (item.data.dynamicNews) {
                        dynamics.push(item.data.dynamicNews);
                        msgIds[i++] = item.messageId;
                    }
                });
            } else {
                dynamics = results;
                dynamics = _.reject(dynamics, function(val){
                    return (val == undefined);
                });
            }
            return common.findLikeDynamicUsers(req.user&&req.user.id, dynamics);
        }).then(function(likeResult){
            var retDynamic = [];
            var i = 0;
            _.each(dynamics, function(dynamic){

                var userId = dynamic.get('user_id');
                var activity = dynamic.get('activityId');
                dynamic = dynamic._toFullJSON();
                if (userId) {
                    dynamic.user_id = _.pick(userId._toFullJSON(), pickUserKeys);
                }
                if (activity) {
                    dynamic.activityId = _.pick(activity._toFullJSON(), pickActivityKeys);
                }

                retDynamic.push({
                    dynamic:dynamic,
                    extra:{
                        isLike:likeResult[dynamic.objectId]?true:false,
                        tagNames:common.tagNameFromId(dynamic.tags),
                        messageId:msgIds?msgIds[i++]:undefined
                    }
                });
            });

            res.success(retDynamic);

        });
    }

    switch (dynamicType) {
        case 'squareDynamic':   //查询用户兴趣相关的广场动态
            var tags = req.user.get('tags');
            var queryOr = [];
            var query;
            _.each(tags, function(tag){
                query = new AV.Query('DynamicNews');
                query.equalTo('tags', tag);
                queryOr.push(query);
            });

            query = new AV.Query('DynamicNews');
            var sahalaAssistants = [];
            _.each(common.getSahalaAssistants(), function(assistantId){
                sahalaAssistants.push(AV.User.createWithoutData('User', assistantId));
            });
            query.containedIn('user_id', sahalaAssistants);
            queryOr.push(query);

            query = AV.Query.or.apply(null, queryOr);
            query.include('user_id', 'activityId');
            query.limit(limit).skip(skip);
            query.descending('createdAt');
            break;

        case 'followeDynamic':  //查询我关注的动态，需要通过事件流查询
            //查询事件流，获取用户关注的所有动态
            var query = AV.Status.inboxQuery(AV.User.createWithoutData('_User',userId));
            var statusReturn = [];
            var dynamics;
            query.equalTo('messageType', 'newPost');
            query.include('dynamicNews');
            query.include('source');
            query.include('dynamicNews.user_id');
            query.include('dynamicNews.activityId');
            query.limit(limit);
            query.maxId(maxId);
            query.exists('dynamicNews');
            break;

        case 'mineDynamic':     //我发出的动态
            var query = new AV.Query('DynamicNews');
            query.equalTo('user_id', AV.User.createWithoutData('_User', userId));
            query.equalTo('type', 2);
            query.include('user_id', 'activityId');
            query.skip(skip);
            query.limit(limit);
            query.descending('createdAt');
            break;

        case 'clanDynamic': //查询部落动态和问答
            var clanId = req.params.clanId;
            if (!clanId) {
                res.error('请输入部落信息！');
            }

            //1、找到部落成员
            //2、找到这些成员的动态，动态部落为空
            //3、找到这些成员的动态，动态部落包含该部落
            var queryUser = new AV.Query('ClanUser');
            queryUser.equalTo('clan_id', AV.Object.createWithoutData('Clan', clanId));
            queryUser.limit(1000);
            queryUser.find().then(function(clanUsers){
               var users = [];
                _.each(clanUsers, function(clanUser){
                    users.push(clanUser.get('user_id'));
                });

                var queryInClanIds = new AV.Query('DynamicNews');
                queryInClanIds.exists('clan_ids');
                queryInClanIds.equalTo('clan_ids', clanId);
                queryInClanIds.containedIn('user_id', users);

                var queryIncludeUser;
                queryIncludeUser = new AV.Query('DynamicNews');
                queryInClanIds.doesNotExist('clan_ids');
                queryIncludeUser.containedIn('user_id', users);

                var query = AV.Query.or(queryInClanIds, queryIncludeUser);
                query.equalTo('type', 2);
                query.include('user_id', 'activityId');
                query.skip(skip);
                query.limit(limit);
                query.descending('createdAt');

                findDynamicAndReturn(query);
            });

            return;

        case 'favoriteDynamic': //获取收藏动态或问答信息
            console.info('favoriteDynamic params:', req.params);
            var favoriteIds = req.params.favoriteIds || [];
            if (favoriteIds.length <= 0) {
                res.error('请输入收藏的动态或问答信息！');
                return;
            }
            var query = new AV.Query('DynamicNews');
            query.equalTo('type', 2);
            if (favoriteIds.length > 0) {
                limit = favoriteIds.length;
                query.containedIn('objectId', favoriteIds);
            }
            query.include('user_id', 'activityId');
            query.skip(skip);
            query.limit(limit);
            query.descending('createdAt');
            break;

        case 'commentDynamic':  //我评论过的动态
            var query = new AV.Query('DynamicNews');
            query.skip(skip);
            query.limit(limit);
            query.include('user_id', 'activityId');
            query.equalTo('commentUsers', userId);
            query.equalTo('type', 2);
            query.descending('createdAt');
            break;

        case 'activityDynamic': // 活动相关动态
            var activityId = req.params.activityId;
            if (!activityId) {
                res.error('缺少必备参数！');
                return;
            }

            //查询活动相关动态
            var query = new AV.Query('DynamicNews');
            query.include('user_id', 'activityId');
            query.equalTo('activityId', AV.Object.createWithoutData('Activity', activityId));
            query.equalTo('type', 2);
            query.descending('createdAt');
            query.limit(limit);
            query.skip(skip);
            break;

        default :
            console.error('查询类型未知：', dynamicType)
            res.error('未知的查询类型！');
            return;
    }

    findDynamicAndReturn(query);
});

/**
 *  获取动态
 */
AV.Cloud.define('getDynamic', function(req,res){
    var dynamicType = req.params.dynamicType || 'followeDynamic';	//获取的动态类型
    switch (dynamicType) {
        case "followeDynamic":	//查询我关注的动态，需要通过事件流查询
            /**	request param
             {
                 dynamicType:followeDynamic,
                 limit:N default is 20,
                 maxId:N default is zero
             }
             */
            var userId = req.params.userId || (req.user?req.user.id:undefined);
            if (!userId) {
                res.error('缺少用户信息！');
                return;
            }
            var limit = req.params.limit || 20;
            var maxId = req.params.maxId || 0;
            var likeTarget = {};	//记录该用户点过赞的id
            var date1, date2, date3;

            //查询事件流，获取用户关注的所有动态
            var query = AV.Status.inboxQuery(AV.User.createWithoutData('_User',userId));
            var statusReturn = [];
            query.equalTo('messageType', 'newPost');
            query.include('dynamicNews');
            query.include('source');
            query.include('dynamicNews.user_id');
            query.include('dynamicNews.activityId');
            query.limit(limit);
            query.maxId(maxId);
            query.exists('dynamicNews');
            date1 = new Date();
            query.find().then(function(statuses){
                if (!statuses) {
                    res.success([]);
                    return;
                }

                console.info("count:%d limit:%d", statuses.length, limit);

                date2 = new Date();
                console.info("userid:%s dynamic finding use time:%d ms", userId, date2.getTime()-date1.getTime());
                //获取所有动态objectId，再查询该用户对这些动态是否点过赞
                var dynamicIdArray = [];
                for (var i=0; i<statuses.length; i++) {
                    if (statuses[i].data.dynamicNews && statuses[i].data.source) {
                        dynamicIdArray.push(statuses[i].data.dynamicNews.id);
                    } else {
                        statuses[i] = undefined;
                    }
                }
                statusReturn = statuses = AV._.reject(statuses, function(val){
                    return (val == undefined);
                });

                //查询点赞表
                var likeClass = AV.Object.extend("Like");
                var likeQuery = new AV.Query(likeClass);
                likeQuery.equalTo('user_id', AV.User.createWithoutData('_User', userId));
                likeQuery.containedIn('external_id', dynamicIdArray);
                return likeQuery.find();
            }, function(err){
                //查询失败
                console.error('查询动态表失败：', err);
                res.error('查询关注动态信息失败！');
            }).then(function(likes){
                date3 = new Date();
                console.info("userid:%s,dynamic like finding use time:%d ms", userId, date3.getTime()-date2.getTime());
                for (var i in likes) {
                    likeTarget[likes[i].get('external_id')] = true;
                }

                var pickActivityKeys = ['objectId','__type', 'title', "className"];
                var pickUserKeys = ['objectId','__type', 'nickname', 'username', 'icon', "className"];
                var hpTags = AV.HPGlobalParam.hpTags;
                var _ = AV._;
                //将所有动态返回，添加isLike，记录点赞状态
                for (var i in statusReturn) {
                    var currDynamic = statusReturn[i].data.dynamicNews;
                    var user_id = currDynamic.get('user_id');
                    var activityId = currDynamic.get('activityId');
                    currDynamic = currDynamic._toFullJSON();
                    if (user_id) {
                        currDynamic.user_id = user_id._toFullJSON();
                        currDynamic.user_id = _.pick(currDynamic.user_id, pickUserKeys);
                    }
                    if (activityId) {
                        activityId = activityId._toFullJSON();
                        currDynamic.activityId = _.pick(activityId, pickActivityKeys);
                    }
                    statusReturn[i].data.dynamicNews = currDynamic;

                    if (likeTarget[currDynamic.objectId] == true)	//添加点赞状态字段
                        currDynamic.isLike = true;
                    else
                        currDynamic.isLike = false;

                    //从tagId转换tagName，并返回给APP
                    if (hpTags) {
                        var arrayTagName = [];
                        for (var k in currDynamic.tags) {
                            arrayTagName.push(hpTags[currDynamic.tags[k]]&&hpTags[currDynamic.tags[k]].get('tag_name') || '');
                        }
                        if (arrayTagName.length) {
                            currDynamic.tagNames = arrayTagName;
                        }
                    }

                }

                res.success(statusReturn);
            }, function(error){
                res.error('查询点赞状态失败，错误码：'+error.code);
            });

            break;

        case 'mineDynamic':     //我发出的动态
            var userId = req.params.userId;
            if (!userId) {
                res.error('缺少用户信息！');
                return;
            }
            var limit = req.params.limit || 20;
            var skip = req.params.skip || 0;
            var type = req.params.type || 2;

            var query = new AV.Query('DynamicNews');
            query.equalTo('user_id', AV.User.createWithoutData('_User', userId));
            query.equalTo('type', parseInt(type));
            query.include('user_id', 'activityId');
            query.skip(skip);
            query.limit(limit);
            query.descending('createdAt');
            query.find().then(function(dynamics) {
                if (!dynamics) {
                    res.success([]);
                    return;
                }

                common.addLikesAndReturn(req.user&&req.user.id, dynamics, res);
            }, function(error) {
                console.error('getDynamic mineDynamic failed:', error);
                res.success([]);
            });
            break;

        case 'clanDynamic': //查询部落动态和问答
            var userId = req.params.userId;
            var clanId = req.params.clanId;
            if (!userId || !clanId) {
                res.error('请输入部落和用户信息！');
            }
            var limit = req.params.limit || 20;
            var skip = req.params.skip || 0;
            var type = req.params.type;

            var queryInClanIds = new AV.Query('DynamicNews');
            queryInClanIds.equalTo('clan_ids', clanId);
            var queryEqualToClan = new AV.Query('DynamicNews');
            if (clanId) {
                queryEqualToClan.equalTo('clan_id', AV.Object.createWithoutData('Clan', clanId));
            }

            var query = AV.Query.or(queryInClanIds, queryEqualToClan);
            if (type) {
                query.equalTo('type', parseInt(type));
            }
            query.include('user_id', 'activityId');
            query.skip(skip);
            query.limit(limit);
            query.descending('createdAt');
            query.find().then(function(dynamics) {
                if (!dynamics) {
                    res.success([]);
                    return;
                }

                common.addLikesAndReturn(req.user&&req.user.id, dynamics, res);
            }, function(error) {
                console.error('getDynamic mineDynamic failed:', error);
                res.success([]);
            });
            break;

        case 'favoriteDynamic': //获取收藏动态或问答信息
            console.info('favoriteDynamic params:', req.params);
            var favoriteIds = req.params.favoriteIds || [];
            if (favoriteIds.length <= 0) {
                res.error('请输入收藏的动态或问答信息！');
                return;
            }
            var userId = req.params.userId;
            var limit = req.params.limit || favoriteIds.length;
            var skip = req.params.skip || 0;
            var type = req.params.type || 2;

            var query = new AV.Query('DynamicNews');
            query.equalTo('type', parseInt(type));
            if (favoriteIds.length > 0) {
                query.containedIn('objectId', favoriteIds);
            }
            query.include('user_id', 'activityId');
            query.skip(skip);
            query.limit(limit);
            query.descending('createdAt');
            query.find().then(function(dynamics) {
                if (!dynamics) {
                    res.success([]);
                    return;
                }

                common.addLikesAndReturn(req.user&&req.user.id, dynamics, res);
            }, function(error) {
                console.error('getDynamic favoriteDynamic failed:', error);
                res.success([]);
            });
            break;

        case 'commentDynamic':  //我评论过的动态
            var userId = req.params.userId;
            if (!userId) {
                res.error('缺少用户信息！');
                return;
            }
            var limit = req.params.limit || 20;
            var skip = req.params.skip || 0;
            var type = req.params.type || 2;
            var query = new AV.Query('DynamicNews');
            query.skip(skip);
            query.limit(limit);
            query.include('user_id', 'activityId');
            query.equalTo('commentUsers', userId);
            query.equalTo('type', parseInt(type));
            query.descending('createdAt');
            query.find().then(function(dynamics) {
                if (!dynamics) {
                    res.success([]);
                    return;
                }
                common.addLikesAndReturn(req.user&&req.user.id, dynamics, res);
            }, function(error) {
                console.error('getDynamic commentDynamic failed:', error);
                res.success([]);
            });
            break;

        case 'activityDynamic': // 活动相关动态
            var userId = req.params.userId;
            if (!userId && req.user) {
                userId = req.user.id;
            }
            var activityId = req.params.activityId;
            if (!userId || !activityId) {
                res.error('缺少必备参数！');
                return;
            }
            var limit = req.params.limit || 20;
            var skip = req.params.skip || 0;
            var retVal = {};

            var query = new AV.Query('Activity');
            query.get(activityId).then(function(result){
                retVal.activity = result;

                //查询活动相关动态
                query = new AV.Query('DynamicNews');
                query.include('user_id', 'activityId');
                query.equalTo('activityId', AV.Object.createWithoutData('Activity', activityId));
                query.descending('createdAt');
                query.limit(limit);
                query.skip(skip);
                return query.find();
            }).then(function(results){

                return common.addLikesAndReturn(req.user&&req.user.id, results);
            }).then(function(dynamics){
                if (dynamics) {
                    retVal.dynamics = [];
                    var _ = AV._;
                    dynamics.forEach(function(dynamic){
                        var user_id = dynamic.get('user_id');
                        var activityId = dynamic.get('activityId');

                        dynamic = dynamic._toFullJSON();
                        if (activityId) {
                            activityId.__type = 'Object';
                            dynamic.activityId = activityId;
                        }
                        if (user_id) {
                            user_id.__type = 'Object';
                            dynamic.user_id = user_id;
                        }

                        retVal.dynamics.push(dynamic);
                    });
                }

                res.success(retVal);
            }, function(err){
                console.error('activityDynamic error:', err);

                res.error('获取活动相关动态失败,错误码:'+err.code);
            });
            break;
    }
});

/*
    获取动态、资讯、活动等相关评论
    云函数：
        getComments2 (用于替换getComments)
    参数：
        sourceId:objectId  动态、资讯 or 活动 等ID
        commentId:objectId 查询指定的评论ID
        limit、skip:分页查询参数
        commentType:
            dynamic:    动态评论
            news:       资讯评论
            activity:   活动评论
    返回：
        [
            {
                comment: comment class object
            },
            ...
        ]
 */
AV.Cloud.define('getComments2', function(req, res){
    var sourceId = req.params.sourceId;
    var commentId = req.params.commentId;
    var limit = req.params.limit || 20;
    var skip = req.params.skip || 0;
    var commentType = req.params.commentType || 'dynamic';

    if (!sourceId) {
        res.error('请输入动态ID!');
        return;
    }
    var query;
    switch (commentType) {
        case 'news':
            query = new AV.Query('NewsComment');
            if (sourceId) {
                query.equalTo('newsid', AV.Object.createWithoutData('News',sourceId));
            }
            break;
        case 'activity':
            query = new AV.Query('ActivityComment');
            if (sourceId) {
                query.equalTo('activity_id', AV.Object.createWithoutData('Activity',sourceId));
            }
            break;
        case 'dynamic':
        default :
            query = new AV.Query('DynamicComment');
            if (sourceId) {
                query.equalTo('dynamic_id', AV.Object.createWithoutData('DynamicNews',sourceId));
            }
            break;
    }
    if (commentId) {    //查询指定的评论ID
        query.equalTo('objectId', commentId);
    }
    query.equalTo('status', 1);
    query.include('user_id', 'reply_userid');
    query.skip(skip);
    query.limit(limit);
    query.descending('createdAt');
    query.find().then(function(results){
        //保留的user keys
        var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "__type"];
        var retVal = [];
        _.each(results, function(comment){
            var postUser = comment.get('user_id');
            var replyUser = comment.get('reply_userid');
            comment.unset('append_userinfo');
            comment.unset('append_replyinfo');

            comment = comment._toFullJSON();
            comment.user_id = _.pick(postUser._toFullJSON(), pickUserKeys);
            if (replyUser) {
                comment.reply_userid = _.pick(replyUser._toFullJSON(), pickUserKeys);
            }

            retVal.push({
                comment:comment
            });
        });

        res.success(retVal);
    });
});

/**
 *  获取动态、资讯、活动等相关评论
 */
AV.Cloud.define('getComments', function(req,res) {
    console.info('user friend count %d', req.user.get('friendCount'));

    var sourceId = req.params.sourceId;
    var commentId = req.params.commentId;
    var limit = req.params.limit || 20;
    var skip = req.params.skip || 0;
    var commentType = req.params.commentType || 3;
    commentType = parseInt(commentType);

    if (!sourceId) {
        res.error('请输入动态ID!');
        return;
    }
    var query;
    switch (commentType) {
        case 1:
            query = new AV.Query('NewsComment');
            if (sourceId) {
                query.equalTo('newsid', AV.Object.createWithoutData('News',sourceId));
            }
            break;
        case 2:
            query = new AV.Query('ActivityComment');
            if (sourceId) {
                query.equalTo('activity_id', AV.Object.createWithoutData('Activity',sourceId));
            }
            break;
        case 3:
        default :
            query = new AV.Query('DynamicComment');
            if (sourceId) {
                query.equalTo('dynamic_id', AV.Object.createWithoutData('DynamicNews',sourceId));
            }
            break;
    }
    if (commentId) {    //查询指定的评论ID
        query.equalTo('objectId', commentId);
    }
    query.equalTo('status', 1);
    query.include('user_id', 'reply_userid');
    query.skip(skip);
    query.limit(limit);
    query.descending('createdAt');
    query.find().then(function(results){
        for (var i in results) {
            //replace 'user_info' attribute
            var postUser = results[i].get('user_id');
            if (postUser) {
                var userInfo = {
                    icon:postUser.get('icon') || "",
                    nickname:postUser.get('nickname')
                };
                if (commentType==1) {
                    results[i].set('append_userinfo', userInfo);
                } else {
                    results[i].set('user_info', userInfo);
                }
            }

            //replace 'append_replyinfo
            var replyUser = results[i].get('reply_userid');
            if (replyUser) {
                var userInfo = {
                    icon:replyUser.get('icon') || "",
                    nickname:replyUser.get('nickname')
                };
                results[i].set('append_replyinfo', userInfo);
            }
        }

        res.success(results);
    });
});

/*** 提交动态、资讯、活动评论
 **/
AV.Cloud.define('postComment', function(req, res){
    var userId = req.params.userId;
    var userNickname = req.params.userNickname;
    var userIcon = req.params.userIcon;
    var sourceId = req.params.sourceId;
    var commentType = req.params.commentType;
    var content = req.params.content;
    var replyUserId = req.params.replyUserId;
    var replyUserNickname = req.params.replyUserNickname;
    var replyUserIcon = req.params.replyUserIcon;
    commentType = parseInt(commentType);

    var commentObj;
    switch (commentType) {
        case 1:
            var CommentClass = AV.Object.extend('NewsComment');
            commentObj = new CommentClass();
            commentObj.set('newsid', AV.Object.createWithoutData('News', sourceId));
            commentObj.set('append_userinfo', {
                nickname:userNickname,
                icon:userIcon||''
            });
            break;
        case 2:
            var CommentClass = AV.Object.extend('ActivityComment');
            commentObj = new CommentClass();
            commentObj.set('activity_id', AV.Object.createWithoutData('Activity', sourceId));
            commentObj.set('user_info', {
                nickname:userNickname,
                icon:userIcon||''
            });
            break;
        case 3:
            var CommentClass = AV.Object.extend('DynamicComment');
            commentObj = new CommentClass();
            commentObj.set('dynamic_id', AV.Object.createWithoutData('DynamicNews', sourceId));
            commentObj.set('user_info', {
                nickname:userNickname,
                icon:userIcon||''
            });
            break;
        default:
            res.error('不支持的评论类型!');
            return;
    }
    commentObj.set('content', content);
    commentObj.set('user_id', AV.User.createWithoutData('_User', userId));
    if (replyUserId) {
        commentObj.set('reply_userid', AV.User.createWithoutData('_User', replyUserId));
        commentObj.set('append_replyinfo', {
            nickname:replyUserNickname,
            icon:replyUserIcon||''
        });
    }
    commentObj.save().then(function(comment){
        res.success(comment);
    }, function(error){
        console.error('postComment error:', error);
        res.error('提交评论失败，错误码:'+error.code);
    })
});

/*
    获取动态详情
    函数名:
        getDynamicDetail
    参数：
        userId:objectId 用户ID
        dynamicId:objectId 动态ID
        getComment:bool,是否获取动态相关评论
        limit、skip：评论对应查询偏移和返回数目
    返回：{
        dynamic: dynamic class object
        extra:{
            isLike: true or false
            tagNames: array 标签对应的名称
        },
        comments:[
            DynamicComment class object
        ]
    }
 */
AV.Cloud.define('getDynamicDetail', function(req, res){
    var userId = req.params.userId || (req.user&&req.user.id);
    var dynamicId = req.params.dynamicId;
    if (!userId || !dynamicId) {
        res.error('请传入相关参数！');
        return;
    }
    var getComment = req.params.getComment;
    var limit = req.params.limit || 20;
    var skip = req.params.skip || 0;

    var retVal = {};
    var retDynamic;
    var query = new AV.Query('DynamicNews');
    query.equalTo('objectId', dynamicId);
    query.include('user_id', 'activityId');
    query.first().then(function(dynamic){
        if (!dynamic) {
            console.info('动态 %s 不存在', dynamicId);
            return AV.Promise.error(new AV.Error(111, '动态不存在!'))
        }
        retDynamic = dynamic;

        return common.findLikeDynamicUsers(userId, dynamic);
    }).then(function(likeObj){
        var bLiked = likeObj && likeObj[retDynamic.id];
        var tags = retDynamic.get('tags');
        var userPost = retDynamic.get('user_id');
        var activityId = retDynamic.get('activityId');

        var pickActivityKeys = ['objectId','__type', 'title', "className"];
        retDynamic = retDynamic._toFullJSON();
        retDynamic.user_id = userPost._toFullJSON();
        if (activityId) {
            retDynamic.activityId = _.pick(activityId._toFullJSON(), pickActivityKeys);
        }

        retVal = {
            dynamic: retDynamic,
            extra:{
                isLike:bLiked,
                tagNames:common.tagNameFromId(tags)
            }
        };
        if (getComment) {
            var query = new AV.Query('DynamicComment');
            query.equalTo('dynamic_id', AV.Object.createWithoutData('DynamicNews', dynamicId));
            query.equalTo('status', 1);
            query.include('user_id', 'reply_userid');
            query.limit(limit);
            query.skip(skip);
            query.descending('createdAt');
            return query.find();
        } else {
            return AV.Promise.as();
        }
    }).then(function(comments){
        if (comments) {
            var pickUserKeys = ['objectId','__type', 'nickname', 'icon', "className"];
            var retComment = [];
            _.each(comments, function(comment){
                var commentUser = comment.get('user_id');
                var replyUser = comment.get('reply_userid');
                comment.unset('user_info');
                comment.unset('append_replyinfo');

                comment = comment._toFullJSON();
                comment.user_id = _.pick(commentUser._toFullJSON(), pickUserKeys);
                if (replyUser) {
                    comment.reply_userid = _.pick(replyUser._toFullJSON(), pickUserKeys);
                }
                retComment.push(comment);
            });

            retVal.comments = retComment;
        }

        res.success(retVal);

    }, function(err){
        console.error('查询动态 %s 详情错误:', dynamicId, err);
        res.success({});
    });
});