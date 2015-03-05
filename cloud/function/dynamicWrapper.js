/**
 * Created by fugang on 14/12/12.
 */

/**
 *  获取动态
 */
AV.Cloud.define('getDynamic', function(req,res){
    function addLikesAndReturn(userId, dynamics, response) {
        var likeTarget = {};	//记录该用户点过赞的id
        var returnUserItem = {	//动态中发布者信息，可以保留返回的字段
            objectId:1,
            username:1,
            nickname:1,
            className:1,
            icon:1,
            __type:1
        };

        //为动态或问答加入点赞状态
        var addLikeTarget = function(dynamics, likeTarget) {
            var hpTags = AV.HPGlobalParam.hpTags;
            //将所有动态返回，添加isLike，记录点赞状态，添加tagName字段，去掉user字段中多余的信息
            for (var i in dynamics) {
                var currDynamic = dynamics[i];
                if (likeTarget[currDynamic.id] == true)	//添加点赞状态字段
                    currDynamic.set('isLike', true);
                else
                    currDynamic.set('isLike', false);

                //从tagId转换tagName，并返回给APP
                if (hpTags) {
                    var arrayTagName = [];
                    for (var k in currDynamic.tags) {
                        arrayTagName.push(hpTags[currDynamic.tags[k]].get('tag_name') || '');
                    }
                    if (arrayTagName.length) {
                        currDynamic.set('tagName', arrayTagName);
                    }
                }

                //遍历user_id，去掉不需要返回的字段，减少网络传输
                var rawUser = currDynamic.get('user_id');
                if (rawUser && rawUser.id) {
                    var postUser = AV.Object.createWithoutData('_User', rawUser.id);
                    postUser.set('icon', rawUser.get('icon'));
                    postUser.set('nickname', rawUser.get('nickname'));
                    var jValue = postUser._toFullJSON();
                    delete jValue.__type;
                    currDynamic.set('user_id', jValue);
                }

            }
        }

        //获取所有动态objectId，再查询该用户对这些动态是否点过赞
        var dynamicIdArray = [];
        for (var i=0; i<dynamics.length; i++) {
            if (dynamics[i].get('user_id')) {
                dynamicIdArray.push(dynamics[i].id);
            } else {    //删除不合法的数据
                dynamics[i] = undefined;
            }
        }

        dynamics = AV._.reject(dynamics, function(val){
            return (val == undefined);
        });

        //查询点赞表
        var likeClass = AV.Object.extend("Like");
        var likeQuery = new AV.Query(likeClass);
        likeQuery.equalTo('user_id', AV.User.createWithoutData('_User', userId));
        likeQuery.containedIn('external_id', dynamicIdArray);
        likeQuery.find().then(function(likes) {
            for (var i in likes) {
                likeTarget[likes[i].get('external_id')] = true;
            }

            addLikeTarget(dynamics, likeTarget);

            response.success(dynamics);
        }, function(error) {
            console.error('query dynamic like failed:', error);
            addLikeTarget(dynamics, likeTarget);
            response.success(dynamics);
        });

    }

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
            var userId = req.params.userId;
            if (!userId) {
                res.error('缺少用户信息！');
                return;
            }
            var limit = req.params.limit || 20;
            var maxId = req.params.maxId || 0;
            var likeTarget = {};	//记录该用户点过赞的id
            var returnUserItem = {	//动态中发布者信息，可以保留返回的字段
                objectId:1,
                username:1,
                nickname:1,
                className:1,
                icon:1,
                __type:1
            };
            var date1, date2, date3;

            //查询事件流，获取用户关注的所有动态
            var query = AV.Status.inboxQuery(AV.User.createWithoutData('_User',userId));
            var statusReturn = [];
            query.include('dynamicNews');
//            query.include('source');
            query.include('dynamicNews.user_id');
            query.containedIn('messageType', ['newPost', 'newQuestion']);
            query.limit(limit);
            query.maxId(maxId);
            query.exists('dynamicNews');
            date1 = new Date();
            query.find().then(function(statuses){
                if (!statuses) {
                    res.success([]);
                    return;
                }
                date2 = new Date();
                console.info("userid:%s dynamic finding use time:%d ms", userId, date2.getTime()-date1.getTime());
                //获取所有动态objectId，再查询该用户对这些动态是否点过赞
                var dynamicIdArray = [];
                for (var i=0; i<statuses.length; i++) {
                    if (statuses[i].data.dynamicNews && statuses[i].data.source) {
                        dynamicIdArray.push(statuses[i].data.dynamicNews.objectId);
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


                var hpTags = AV.HPGlobalParam.hpTags;
                //将所有动态返回，添加isLike，记录点赞状态
                for (var i in statusReturn) {
                    var currDynamic = statusReturn[i].data.dynamicNews;
                    var user_id = currDynamic.get('user_id');
                    currDynamic = currDynamic._toFullJSON();
                    currDynamic.user_id = user_id._toFullJSON();
                    statusReturn[i].data.dynamicNews = currDynamic;
                    
                    if (likeTarget[currDynamic.objectId] == true)	//添加点赞状态字段
                        currDynamic.isLike = true;
                    else
                        currDynamic.isLike = false;

                    //从tagId转换tagName，并返回给APP
                    if (hpTags) {
                        var arrayTagName = [];
                        for (var k in currDynamic.tags) {
                            arrayTagName.push(hpTags[currDynamic.tags[k]].get('tag_name') || '');
                        }
                        if (arrayTagName.length) {
                            currDynamic.tagNames = arrayTagName;
                        }
                    }

                    //遍历user_id，去掉不需要返回的字段，减少网络传输
                    for (var k in currDynamic.user_id) {
                        if (returnUserItem[k] != 1) {
                            delete currDynamic.user_id[k];
                        }
                    }

                }

                res.success(statusReturn);
            }, function(error){
                res.error('查询点赞状态失败:%o', error);
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
            query.include('user_id');
            query.skip(skip);
            query.limit(limit);
            query.descending('createdAt');
            query.find().then(function(dynamics) {
                if (!dynamics) {
                    res.success([]);
                    return;
                }

                addLikesAndReturn(userId, dynamics, res);
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
            query.include('user_id');
            query.skip(skip);
            query.limit(limit);
            query.descending('createdAt');
            query.find().then(function(dynamics) {
                if (!dynamics) {
                    res.success([]);
                    return;
                }

                addLikesAndReturn(userId, dynamics, res);
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
            query.include('user_id');
            query.skip(skip);
            query.limit(limit);
            query.descending('createdAt');
            query.find().then(function(dynamics) {
                if (!dynamics) {
                    res.success([]);
                    return;
                }

                addLikesAndReturn(userId, dynamics, res);
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
            query.include('user_id');
            query.equalTo('commentUsers', userId);
            query.equalTo('type', parseInt(type));
            query.descending('createdAt');
            query.find().then(function(dynamics) {
                if (!dynamics) {
                    res.success([]);
                    return;
                }
                addLikesAndReturn(userId, dynamics, res);
            }, function(error) {
                console.error('getDynamic commentDynamic failed:', error);
                res.success([]);
            });
            break;
    }
});


/**
 *  获取动态、资讯、活动等相关评论
 */
AV.Cloud.define('getComments', function(req,res) {
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
                    icon:postUser.get('icon'),
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
                    icon:replyUser.get('icon'),
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
                icon:userIcon
            });
            break;
        case 2:
            var CommentClass = AV.Object.extend('ActivityComment');
            commentObj = new CommentClass();
            commentObj.set('activity_id', AV.Object.createWithoutData('Activity', sourceId));
            commentObj.set('user_info', {
                nickname:userNickname,
                icon:userIcon
            });
            break;
        case 3:
            var CommentClass = AV.Object.extend('DynamicComment');
            commentObj = new CommentClass();
            commentObj.set('dynamic_id', AV.Object.createWithoutData('DynamicNews', sourceId));
            commentObj.set('user_info', {
                nickname:userNickname,
                icon:userIcon
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
            icon:replyUserIcon
        });
    }
    commentObj.save().then(function(comment){
        res.success(comment);
    }, function(error){
        console.error('postComment error:', error);
        res.error(error);
    })
});