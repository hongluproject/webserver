/**
 * Created by fugang on 14/12/12.
 */
var common = require('cloud/common');
var _ = AV._;
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
        limit:Integer   本次查询返回数目
        skip:Integer    本次查询起始偏移
        maxId:Integer   由于followeDynamic采用事件流获取，需要用maxId替换skip来获取数据
    返回：
        [
            {
                dynamic:DynamicNews class object
                extra:{
                    isLike: true or false
                    tagNames: array  动态tagIds对应的名称
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

    var pickActivityKeys = ['objectId','__type', 'title', "className"];
    var pickUserKeys = ['objectId','__type', 'nickname', 'username', 'icon', "className"];
    switch (dynamicType) {
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

            var queryInClanIds = new AV.Query('DynamicNews');
            queryInClanIds.equalTo('clan_ids', clanId);
            var queryEqualToClan = new AV.Query('DynamicNews');
            if (clanId) {
                queryEqualToClan.equalTo('clan_id', AV.Object.createWithoutData('Clan', clanId));
            }

            var query = AV.Query.or(queryInClanIds, queryEqualToClan);
            query.equalTo('type', 2);
            query.include('user_id', 'activityId');
            query.skip(skip);
            query.limit(limit);
            query.descending('createdAt');
            break;

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

    query.find().then(function(results){
        if (dynamicType == 'followeDynamic') {
            dynamics = [];
            _.each(results, function(item){
                if (item.data.dynamicNews) {
                    dynamics.push(item.data.dynamicNews);
                }
            });
        } else {
            dynamics = results;
            dynamics = _.reject(dynamics, function(val){
                return (val == undefined);
            });
        }
        return common.findLikeDynamicUsers(userId, dynamics);
    }).then(function(likeResult){
        var retDynamic = [];
        _.each(dynamics, function(dynamic){

            var userId = dynamic.get('user_id');
            var activityId = dynamic.get('activityId');
            dynamic = dynamic._toFullJSON();
            dynamic.user_id = _.pick(userId._toFullJSON(), pickUserKeys);
            if (activityId) {
                dynamic.activityId = _.pick(activityId._toFullJSON(), pickActivityKeys);
            }

            retDynamic.push({
                dynamic:dynamic,
                extra:{
                    isLike:likeResult[dynamic.objectId]?true:false,
                    tagNames:common.tagNameFromId(dynamic.tags)
                }
            });
        });

        res.success(retDynamic);

    });});

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

                common.addLikesAndReturn(userId, dynamics, res);
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

                common.addLikesAndReturn(userId, dynamics, res);
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

                common.addLikesAndReturn(userId, dynamics, res);
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
                common.addLikesAndReturn(userId, dynamics, res);
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

                return common.addLikesAndReturn(req, results);
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

 */
AV.Cloud.define('getDynamicDetail', function(req, res){

});