/**
 * Created by gary on 14-9-28.
 */
var utils = require('cloud/utils.js');
var querystring = require('querystring');
var _ = AV._;
var Promise = AV.Promise;

// 对Date的扩展，将 Date 转化为指定格式的String
// 月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符，
// 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字)
// 例子：
// (new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423
// (new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18
Date.prototype.Format = function(fmt)
{ //author: meizz
    var o = {
        "M+" : this.getMonth()+1,                 //月份
        "d+" : this.getDate(),                    //日
        "h+" : this.getHours(),                   //小时
        "m+" : this.getMinutes(),                 //分
        "s+" : this.getSeconds(),                 //秒
        "q+" : Math.floor((this.getMonth()+3)/3), //季度
        "S"  : this.getMilliseconds()             //毫秒
    };
    if(/(y+)/.test(fmt))
        fmt=fmt.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length));
    for(var k in o)
        if(new RegExp("("+ k +")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));
    return fmt;
}

exports.pad = function(num, n) {
    return (Array(n).join(0) + num).slice(-n);
}

exports.clanParam = {
    getMaxClanUsers : function(level) {
        level = level || 1;
        AV.HPGlobalParam = AV.HPGlobalParam || {};
        if (AV.HPGlobalParam.hpLevels && AV.HPGlobalParam.hpLevels[level]) {
            return AV.HPGlobalParam.hpLevels[level].get('maxClanUsers')||100;
        }

        switch (level) {
            case 1:
                return 100;
            case 2:
                return 500;
        }

        return 100;
    },

    getMaxCreateClan : function(level) {
        level = level || 1;
        AV.HPGlobalParam = AV.HPGlobalParam || {};
        if (AV.HPGlobalParam.hpLevels && AV.HPGlobalParam.hpLevels[level]) {
            return AV.HPGlobalParam.hpLevels[level].get('maxCreateClan')||5;
        }

        switch (level) {
            case 1:
                return 5;
            case 2:
                return 5;
        }

        return 5;
    }
};

exports.getUserGrownWithLevel = function(level) {
    AV.HPGlobalParam = AV.HPGlobalParam || {};
    if (AV.HPGlobalParam.hpLevels) {
        return AV.HPGlobalParam.hpLevels[level];
    }

    return undefined;
}

exports.newsResultWapper2 = function(userId, results) {
    var HPGlobalParam = AV.HPGlobalParam || {};
    var retResult = [];
    var newsIds = [];
    var likeTarget = {};

    _.each(results, function(newsItem){
        var retItem = {};
        var extraData = {};

        newsIds.push(newsItem.id);

        //tags列表最多返回3个，否则前端会显示不下
        var tags = newsItem.get('tags');
        if (tags && tags.length>3) {
            tags.splice(3, tags.length-3);
            newsItem.set('tags', tags);
        }

        //返回cate名称
        var arrayCateName = [];
        var arrayCate = newsItem.get('cateids');
        _.each(arrayCate, function(cateItem){
            var name = (HPGlobalParam.hpCates[cateItem]&&HPGlobalParam.hpCates[cateItem].get('cate_name')) || '';
            arrayCateName.push(name);
        });
        extraData.cateName = arrayCateName;

        //返回area名称
        var arrayAreaName = [];
        var arrayArea = newsItem.get('areas');
        _.each(arrayArea, function(areaItem){
            var name = (HPGlobalParam.hpAreas[areaItem] && HPGlobalParam.hpAreas[areaItem].get('title')) || '';
            arrayAreaName.push(name);
        });
        extraData.areaName = arrayAreaName;


        //返回tags名称
        var arrayTagName = [];
        var arrayTag = newsItem.get('tags');
        _.each(arrayTag, function(tagItem){
            var name = (HPGlobalParam.hpTags[tagItem] && HPGlobalParam.hpTags[tagItem].get('tag_name')) || '';
            arrayTagName.push(name);
        });
        extraData.tagNames = arrayTagName;

        retItem.news = newsItem._toFullJSON();
        retItem.extra = extraData;
        retResult.push(retItem);
    });
    if (userId && retResult.length) {
        //根据资讯&用户id，查询点赞信息
        var likeClass = this.extendClass("Like");
        var queryLike = new AV.Query(likeClass);
        queryLike.equalTo('like_type', 1);
        queryLike.equalTo('user_id', AV.User.createWithoutData('_User', userId));
        queryLike.containedIn('external_id', newsIds);
        return queryLike.find().then(function(likes) {
            if (!likes) {
                return AV.Promise.as(retResult);
            }
            _.each(likes, function(likeItem){
                likeTarget[likeItem.get('external_id')] = likeItem.id;
            })

            _.each(retResult, function(resItem){
                var newsItem = resItem.news;
                if (likeTarget[newsItem.id]) {
                    resItem.extra.isLike = true;
                    resItem.extra.likeObjectId = likeTarget[newsItem.id];
                } else {
                    resItem.extra.isLike = false;
                }
            });

            return AV.Promise.as(retResult);
        });
    } else {
        return AV.Promise.as(retResult);
    }
}


/* @params:
    userId: user objectId, maybe null
    results: news result
   @return:wrapped promise result

    资讯查询返回内容包装：增加点赞
 */
exports.newsResultWapper = function(userId, results) {
    var HPGlobalParam = AV.HPGlobalParam || {};
    var newsIds = [];
    var likeTarget = {};	//记录该用户点过赞的id
    for (var i in results) {
        newsIds.push(results[i].id);

        //tags列表最多返回3个，否则前端会显示不下
        var tags = results[i].get('tags');
        if (tags && tags.length>3) {
            tags.splice(3, tags.length-3);
            results[i].set('tags', tags);
        }

        //返回cate名称
        var arrayCateName = [];
        var arrayCate = results[i].get('cateids');
        for (var k in arrayCate) {
            var name = '';
            if (HPGlobalParam.hpCates[arrayCate[k]]) {
                name = HPGlobalParam.hpCates[arrayCate[k]].get('cate_name');
            }
            arrayCateName.push(name);
        }
        if (arrayCateName.length) {
            results[i].set('catesName', arrayCateName);
        }

        //返回area名称
        var arrayAreaName = [];
        var arrayArea = results[i].get('areas');
        for (var k in arrayArea) {
            var name = '';
            if (HPGlobalParam.hpAreas[arrayArea[k]]) {
                name = HPGlobalParam.hpAreas[arrayArea[k]].get('title');
            }
            arrayAreaName.push(name);
        }
        if (arrayAreaName.length) {
            results[i].set('areasName', arrayAreaName);
        }

        //返回tags名称
        var arrayTagName = [];
        var arrayTag = results[i].get('tags');
        for (var k in arrayTag) {
            var name = '';
            if (HPGlobalParam.hpTags[arrayTag[k]]) {
                name = HPGlobalParam.hpTags[arrayTag[k]].get('tag_name');
            }
            arrayTagName.push(name);
        }
        if (arrayTagName.length) {
            results[i].set('tagsName', arrayTagName);
        }

    }

    if (userId && results && results.length) {
        //根据资讯&用户id，查询点赞信息
        var likeClass = this.extendClass("Like");
        var queryLike = new AV.Query(likeClass);
        queryLike.equalTo('like_type', 1);
        queryLike.equalTo('user_id', AV.User.createWithoutData('_User', userId));
        queryLike.containedIn('external_id', newsIds);
        return queryLike.find().then(function(likes) {
            for (var k in likes) {
                likeTarget[likes[k].get('external_id')] = likes[k].id;
            }
            //将所有动态返回，添加isLike，记录点赞状态
            for (var k in results) {
                var currNew = results[k];
                var likeObjectId = likeTarget[currNew.id];
                if (likeObjectId) {	//添加点赞状态字段
                    currNew.set('isLike', true);
                    currNew.set('likeObjectId', likeObjectId);
                }
            }

            return AV.Promise.as(results);
        });
    } else {
        return AV.Promise.as(results);
    }


}

exports.getFriendshipUsers = function(findFriendId, users) {
    if (!findFriendId || !users) {
        return {};
    } else {
        var friendList = [];
        _.each(users, function(user){
            if (user) {
                friendList.push(AV.User.createWithoutData('_User', user.id));
            }
        });

        var queryFriend = new AV.Query('_Followee');
        queryFriend.select('followee');
        queryFriend.equalTo('user', AV.User.createWithoutData('_User', findFriendId));
        queryFriend.containedIn('followee', friendList);
        queryFriend.limit(1000);
        return queryFriend.find().then(function(results) {
            var friendObj = {};
            _.each(results, function(result){
                var myFollowee = result.get('followee');
                if (myFollowee) {
                    friendObj[myFollowee.id] = true;
                }
            });

            return AV.Promise.as(friendObj);
        });
    }
}

exports.addFriendShipForUsers = function(findFriendId, users) {
    if (!findFriendId) {
        for (var i in users) {
            users[i].set('isFriend', false);
        }
        return AV.Promise.as(users);
    } else {
        var friendList = [];
        var friendStatus = {};
        for (var i in users) {
            friendList.push(AV.User.createWithoutData('_User', users[i].id));
        }

        var queryFriend = new AV.Query('_Followee');
        queryFriend.select('followee');
        queryFriend.equalTo('user', AV.User.createWithoutData('_User', findFriendId));
        queryFriend.containedIn('followee', friendList);
        queryFriend.limit(1000);
        return queryFriend.find().then(function(results) {
            for (var i in results) {
                var myFollowee = results[i].get('followee');
                if (myFollowee) {
                    friendStatus[myFollowee.id] = true;
                }
            }

            //添加是否为好友字段
            for (var i in users) {
                if (friendStatus[users[i].id]) {
                    users[i].set('isFriend', true);
                } else {
                    users[i].set('isFriend', false);
                }
            }

            return AV.Promise.as(users);
        });
    }


}

/**
 * 在users中，找出和findFriendId是好友关系的用户
 * @param findFriendId  查找的好友用户
 * @param users         用户列表
 * @returns {
 *    userObjectId: true or false
 * }
 */
exports.findFriendShipForUsers = function(findFriendId, users) {
    if (!findFriendId) {
        return AV.Promise.as({});
    } else {
        var friendList = [];
        var friendStatus = {};
        for (var i in users) {
            friendList.push(AV.User.createWithoutData('_User', users[i].id));
        }

        var queryFriend = new AV.Query('_Followee');
        queryFriend.select('followee');
        queryFriend.equalTo('user', AV.User.createWithoutData('_User', findFriendId));
        queryFriend.containedIn('followee', friendList);
        queryFriend.limit(1000);
        return queryFriend.find().then(function(results) {
            _.each(results, function(resItem){
                var myFollowee = resItem.get('followee');
                if (myFollowee) {
                    friendStatus[myFollowee.id] = true;
                }
            });

            return AV.Promise.as(friendStatus);
        });
    }
}

/**
 * 查找对应用户对动态的点赞状态
 * @param findLikeUserId 查找的目标用户
 * @param dynamics       待查找的动态列表
 * @return {
 *     dynamicObjectId: true or false
 * }
 */
exports.findLikeDynamicUsers = function(findLikeUserId, dynamics) {
    var dynamicIds = [];

    if (!_.isArray(dynamics)) {
        //若不是数组，先转换成数组
        dynamics = [dynamics];
    }
    _.each(dynamics, function(dynamic){
        dynamicIds.push(dynamic.id);
    });

    //根据动态&用户id，查询点赞信息
    var likeClass = this.extendClass("Like");
    var queryLike = new AV.Query(likeClass);
    queryLike.equalTo('like_type', 2);
    queryLike.equalTo('user_id', AV.User.createWithoutData('_User', findLikeUserId));
    queryLike.containedIn('external_id', dynamicIds);
    queryLike.limit(1000);
    return queryLike.find().then(function(likes) {
        var retLike = {};
        _.each(likes, function(likeItem){
            retLike[likeItem.get('external_id')] = true;
        });

        return AV.Promise.as(retLike);
    });
}

exports.getCommentDynamicResult = function(userId, dynamics) {
    var dynamicIds = [];

    if (!_.isArray(dynamics)) {
        //若不是数组，先转换成数组
        dynamics = [dynamics];
    }
    _.each(dynamics, function(dynamic){
        dynamicIds.push(dynamic.id);
    });

    var query = new AV.Query('DynamicNews');
    query.containedIn('objectId', dynamicIds);
    query.equalTo('commentUsers', userId);
    query.limit(1000);
    return query.find().then(function(dynamics){
        var commentResult = {};
        _.each(dynamics, function(dynamic){
            if (dynamic) {
                commentResult[dynamic.id] = true;
            }
        });

        return Promise.as(commentResult);
    });
}

/**
 * 查找动态最近10个点赞人，若自己有点赞，则优先返回
 * @param findLikeUserId
 * @param dynamics
 * @return {
 *      dynamicId:users
 * }
 */
exports.getLatestLikesOfDynamic = function(findLikeUserId, dynamics) {
    if (!_.isArray(dynamics)) {
        //若不是数组，先转换成数组
        dynamics = [dynamics];
    }

    var queryOr = [];
    var query;
    _.each(dynamics, function(dynamic){
       if (!dynamic) {
           return;
       }

        query = new AV.Query('Like');
        query.equalTo('external_id', dynamic.id);
        query.equalTo('user_id', AV.User.createWithoutData('User', findLikeUserId));
        query.notEqualTo('like', false);
        queryOr.push(query);

        query = new AV.Query('Like');
        query.equalTo('external_id', dynamic.id);
        query.notEqualTo('user_id', AV.User.createWithoutData('User', findLikeUserId));
        query.notEqualTo('like', false);
        query.limit(10);
        queryOr.push(query);
    });
    if (_.isEmpty(queryOr)) {
        return Promise.as();
    }

    query = AV.Query.or.apply(null, queryOr);
    query.limit(1000);
    query.descending('createdAt');
    query.include('user_id');

    return query.find().then(function(results){
        var likeResult = {}, selfLike = {};
        var likeUsers = [];
        var dynamicId;
        _.each(results, function(like){
            dynamicId = like.get('external_id');
            if (!likeResult[dynamicId]) {
                likeResult[dynamicId] = [];
            }
            var user = like.get('user_id');
            if (user && (user.id==findLikeUserId)) {
                selfLike[dynamicId] = user;
            } else {
                likeResult[dynamicId].push(user);
            }
        });

        for (var dynamicId in likeResult) {
            var likeUsers = likeResult[dynamicId];
            var selfUser = selfLike[dynamicId];
            if (selfUser) {
                likeResult[dynamicId] = [selfUser].concat(likeUsers);
            }
        }

        return AV.Promise.as(likeResult);
    });
}

function isRCPrivateMessage(messageType) {
    if (messageType == 'inviteUserToClan') {
        return true;
    }

    return false;
}

/**
 * 发送融云系统消息s
 * @param fromUserId：消息发起者
 * @param toUserId：消息接收者
 * @param content：消息内容
 * @param messageType：扩展内容，消息类型
 * @param objectId：扩展类型，对应消息类型的objectId
 * @param replyUserId：回复动态评论的用户
 * @param extProp: 扩展信息 {
      title:图文消息标题
      imgUrl:图像消息图像
      clanId:部落ID
  }
 */
function postRCMessage (fromUserId, toUserId, content, messageType,objectId,extProp) {
    var rcParam = utils.getRongCloudParam();
    //通过avcloud发送HTTP的post请求

    var bImgText = extProp&&content&&extProp.title&&extProp.imgUrl;
    var toUsers = [];
    if (toUserId) {
        toUsers = toUsers.concat(toUserId);
    }
    var   body;
    if (bImgText) {
        body = {
            fromUserId: fromUserId,
            toUserId: toUsers,
            objectName: "RC:ImgTextMsg",
            content: JSON.stringify({
                title:extProp.title,
                imageUrl:extProp.imgUrl,
                content: content,
                extra: JSON.stringify({
                    type: messageType,
                    objectId: objectId,
                    clanId:(extProp&&extProp.clanId)||'',
                    activityId:(extProp&&extProp.activityId)||''
                })
            })
        }

    } else {
        body = {
            fromUserId: fromUserId,
            toUserId: toUsers,
            objectName: "RC:TxtMsg",
            content: JSON.stringify({
                content: content,
                extra: JSON.stringify({
                    type: messageType,
                    objectId: objectId,
                    clanId:(extProp&&extProp.clanId)||'',
                    activityId:(extProp&&extProp.activityId)||''
                })
            })
        }
    };

    console.info('rongcloud request body:%s', querystring.stringify(body));

    var postURl = isRCPrivateMessage(messageType)?
            'https://api.cn.rong.io/message/private/publish.json':
            'https://api.cn.rong.io/message/system/publish.json';
    AV.Cloud.httpRequest({
        method: 'POST',
        url: postURl,
        headers: {
            'App-Key': rcParam.appKey,
            'Nonce': rcParam.nonce,
            'Timestamp': rcParam.timestamp,
            'Signature': rcParam.signature
        },
        body:querystring.stringify(body),
        success: function(httpResponse) {
            console.info('postRCMessage:rongcloud response is '+httpResponse.text);
            delete httpResponse.data.code;
        },
        error: function(httpResponse) {
            console.error('postRCMessage:Request failed with response code %d,errmsg:%s',
                httpResponse.status, httpResponse.text);
        }
    });
}
exports.postRCMessage= postRCMessage;

/**
 * 发送消息流，并且通过融云实时发送消息
 * @param messageType
 * @param sourceUser:AVObject
 * @param targetUser:array, [objectId 1, objectId 2] / AVObject
 * @param query for send status users query condition
 * @param extendProp {
 *      dynamicNews: AVObject for dynamicNews,
 *      replyUser: AVObject for reply user,
 *      clan:   AVObject for clan
 *      activity: AVObject for activity
 * }
 */
exports.sendStatus = function(messageType, sourceUser, targetUser, query, extendProp) {
    var _ = AV._;
    var statusMessageObj = {
        addFriend:"把您加为好友",
        removeFromClan:"被酋长移出了部落",
        newComment:"评论了你的动态",
        newPost:"发布了新的动态",
        newQuestion:'发布了新的问答',
        newLike:"觉得你牛掰了",
        addToClan:"加入了部落",
        quitClan:'用户退出部落',
        joinActivity:"加入了活动",
        refuseToJoinClan:"拒绝您加入部落",
        allowToJoinClan:"允许您加入部落",
        quitActivity:"退出报名",
        updateActivity:"更新活动信息",
        cancelActivity:"取消活动",
        refundSuccess:"退款成功"
    };

    function rcMessageFromType(messageType) {
        var retMsg = '';
        switch (messageType) {
            case 'addFriend':
                retMsg = '我把你加为了好友';
                break;
            case 'removeFromClan':
                var clanName = extendProp && extendProp.clan && extendProp.clan.get('title');
                retMsg = '我把你移出了' + clanName;
                break;
            case 'newPost':
                retMsg = '我发布了新的动态';
                break;
            case 'newLike':
                retMsg = '我觉得你牛掰了';
                break;
            case 'addToClan':
                var clanName = extendProp && extendProp.clan && extendProp.clan.get('title');
                retMsg = '我加入了' + clanName||'';
                break;
            case 'quitClan':
                var clanName = extendProp && extendProp.clan && extendProp.clan.get('title');
                retMsg = '我退出了' + clanName||'';
                break;
            case 'joinActivity':
                var activityName = extendProp && extendProp.activity && extendProp.activity.get('title');
                retMsg = '我加入了' + activityName||'';
                break;
            case 'offlineJoinActivity':
                var activityName = extendProp && extendProp.activity && extendProp.activity.get('title');
                retMsg = '邀请您加入了' + activityName||'';
                break;
            case 'refuseToJoinClan':
                var clanName = extendProp && extendProp.clan && extendProp.clan.get('title');
                retMsg = '我拒绝了你加入' + (clanName||'') + '的请求!';
                break;
            case 'allowToJoinClan':
                var clanName = extendProp && extendProp.clan && extendProp.clan.get('title');
                retMsg = '我通过了你加入' + (clanName||'') + '的请求!';
                break;
            case 'quitActivity':
                var activityName = extendProp && extendProp.activity && extendProp.activity.get('title');
                retMsg = '我退出了' + activityName||'';
                break;
            case 'updateActivity':
                var activityName = extendProp && extendProp.activity && extendProp.activity.get('title');
                retMsg = '我更新了' + (activityName||'') + '信息';
                break;
            case 'cancelActivity':
                var activityName = extendProp && extendProp.activity && extendProp.activity.get('title');
                retMsg = '我取消了' + activityName||'';
                break;
            case 'refundSuccess':
                var activityName = extendProp && extendProp.activity && extendProp.activity.get('title');
                retMsg = activityName + '退款成功';
                break;
        }

        return retMsg || '';
    }

    var toRcUsers = [];
    var status = new AV.Status(null, statusMessageObj[messageType]);
    status.data.source = sourceUser._toPointer();
    status.query = query;
    status.inboxType = exports.inboxtypeFromMessageType(messageType);
    status.set('messageType', messageType);
    if (targetUser) {
        if (_.isArray(targetUser) || _.isString(targetUser)) {
            toRcUsers = toRcUsers.concat(targetUser);
        } else if (targetUser instanceof AV.Object) {
            toRcUsers = toRcUsers.concat(targetUser.id);
            status.set('targetUser', targetUser._toPointer());
        }
    }

    //去掉重复的用户
    toRcUsers = _.uniq(toRcUsers);

    status.set('messageSignature', utils.calcStatusSignature(sourceUser.id,messageType,new Date()));
    switch (messageType) {
        case 'newPost':
        case 'newQuestion':
        case 'newLike':
            status.set('dynamicNews', extendProp.dynamicNews._toPointer());
            break;
        case 'newComment':
            status.set('dynamicNews', extendProp.dynamicNews._toPointer());
            if (extendProp.replyUser) {
                status.set('replyUser', extendProp.replyUser._toPointer());
                toRcUsers = toRcUsers.concat(extendProp.replyUser);
            }
            break;
        case 'removeFromClan':
        case 'refuseToJoinClan':
        case 'allowToJoinClan':
        case 'quitClan':
        case 'addToClan':
            status.set('clan', extendProp.clan._toPointer());
            break;
        case 'offlineJoinActivity':
        case 'joinActivity':
        case 'quitActivity':
        case 'updateActivity':
        case 'cancelActivity':
        case 'refundSuccess':
            status.set('activity', extendProp.activity._toPointer());
            break;
    }
    if (messageType=='newPost' || messageType=='newQuestion') {
        //将此消息发送给所有我的关注者（粉丝），让他们可以看到我的动态
        AV.Status.sendStatusToFollowers(status).then(function(status){
            //发布状态成功，返回状态信息
            console.info("%s 发布动态给粉丝成功!", sourceUser.id);
        }, function(err){
            //发布失败
            console.error("%s 发布动态给粉丝失败!", sourceUser.id);
            console.error(err);
        });

        //再向 dynamic 发送一次
        status.inboxType = 'dynamic';
        AV.Status.sendStatusToFollowers(status).then(function(status){
            //发布状态成功，返回状态信息
            console.info("%s 发布动态给粉丝成功!", sourceUser.id);
        }, function(err){
            //发布失败
            console.error("%s 发布动态给粉丝失败!", sourceUser.id);
            console.error(err);
        });

    } else { //将消息发送到目标用户
        var sendStatusMessage = function() {
            status.send().then(function(status){
                if( messageType=='addFriend' ||
                    messageType=='newLike'||
                    messageType=='addToClan'||
                    messageType=='quitClan'||
                    messageType=='newComment'||
                    messageType=='joinActivity'||
                    messageType=='refuseToJoinClan' ||
                    messageType=='allowToJoinClan' ||
                    messageType=='removeFromClan' ||
                    messageType=='quitActivity' ||
                    messageType=='updateActivity' ||
                    messageType=='cancelActivity' ||
                    messageType=='offlineJoinActivity' ||
                    messageType=='refundSuccess') {
                    //fromUserId, toUserId, content, messageType,objectId
                    if (messageType=='newComment') {
                        if (extendProp && extendProp.replyUser) {
                            //如果是回复评论者，需要通知他
                            postRCMessage(sourceUser.id,extendProp.replyUser.id,'我回复了你的评论',messageType,status.id);
                        }

                        if (sourceUser.id != targetUser.id) {
                            //通知到动态发布者
                            postRCMessage(sourceUser.id,targetUser.id,'我回复了你的动态',messageType,status.id);
                        }

                    } else {
                        postRCMessage(sourceUser.id,toRcUsers,rcMessageFromType(messageType),messageType,status.id,
                            {
                                clanId:extendProp&&extendProp.clan&&extendProp.clan.id,
                                activityId:extendProp&&extendProp.activity&&extendProp.activity.id
                            });
                    }
                }
                console.info('%s 事件流发送成功', messageType);
            },function(error) {
                console.error(error);
            });
        }

        if (!AV.User.current()) {
            console.info('login default user for send status');
            //模拟用户登陆
            AV.User.logIn('18939886042', '111111').then(function(user){
                if (user) {
                    console.info('login default user success!');
                    sendStatusMessage();
                    AV.User.logOut();
                }
            });
        } else {
            sendStatusMessage();
        }

    }



}

exports.isSahalaDevEnv = function() {
    return (AV.applicationId == 'bwc6za4i2iq5m7kxbqmi6h31sp21wjcs2zxsns15q9tbqthq');
}

exports.isOnlinePay = function(payType) {
    return (payType == 2);
}

exports.pingxxAppId = 'app_e18iHKa1KyPKa584';
exports.pingxxAppKey = 'sk_live_q1aX98rz9ev1af9GKGb5W90K';

exports.inboxtypeFromMessageType = function(messageType) {
    switch (messageType) {
        case 'addFriend':
            return 'friend';

        case 'newPost':
            return 'default';

        case 'newLike':
        case 'newComment':
            return 'dynamic';

        case 'removeFromClan':
        case 'addToClan':
        case 'quitClan':
        case 'refuseToJoinClan':
        case 'allowToJoinClan':
            return 'clan';

        case 'offlineJoinActivity':
        case 'joinActivity':
        case 'quitActivity':
        case 'updateActivity':
        case 'cancelActivity':
        case 'refundSuccess':
            return 'activity';

        default:
            return 'system';
  }
}

exports.sliceString = function(str, unicodeLen) {
    var bufSubject = new Buffer(str);
    if (bufSubject.length > unicodeLen) {
        return bufSubject.utf8Slice(0, unicodeLen);
    }

    return str;
}

exports.activityGroupIdForRC = function(activityId) {
    return 'activity-'.concat(activityId);
}

exports.naviGroupIdForRC = function(activityId) {
    return 'chatroom-'.concat(activityId);
}

exports.addLikesAndReturn = function(userId, dynamics, response) {
    var likeTarget = {};	//记录该用户点过赞的id

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

            //返回关联到的活动信息
            var rawActivity = currDynamic.get('activityId');
            if (rawActivity) {
                var activity = AV.Object.createWithoutData('Activity', rawActivity.id);
                activity.set('title', rawActivity.get('title'));
                var jValue = activity._toFullJSON();
                delete jValue.__type;
                currDynamic.set('activityId', jValue);
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
    var likeClass = this.extendClass("Like");
    var likeQuery = new AV.Query(likeClass);
    likeQuery.equalTo('user_id', AV.User.createWithoutData('_User', userId));
    likeQuery.containedIn('external_id', dynamicIdArray);
    return likeQuery.find().then(function(likes) {
        for (var i in likes) {
            likeTarget[likes[i].get('external_id')] = true;
        }

        addLikeTarget(dynamics, likeTarget);

        if (response) {
            response.success(dynamics);
        }

        return AV.Promise.as(dynamics);
    }, function(error) {
        console.error('query dynamic like failed:', error);
        addLikeTarget(dynamics, likeTarget);
        if (response) {
            response.success(dynamics);
        }

        return AV.Promise.as(dynamics);
    });

}

/**
 * 从标签ID获取标签名称
 * @param tags
 * @returns {Array}
 */
exports.tagNameFromId = function(tags) {
    var HPGlobalParam = AV.HPGlobalParam || {};
    var tagArray = [];
    var tagNames = [];

    tagArray = tagArray.concat(tags);
    _.each(tagArray, function(tagItem){
        var tagName = (HPGlobalParam.hpTags && HPGlobalParam.hpTags[tagItem] && HPGlobalParam.hpTags[tagItem].get('tag_name')) || '';
        tagNames.push(tagName);
    });

    return tagNames;
}

/**
 * 从地域ID获取名称
 * @param areaId
 * @returns {Array}
 */
exports.areaNameFromId = function(areaId) {
    var HPGlobalParam = AV.HPGlobalParam || {};
    var areaNames = [];
    var areaIdArray = [];

    areaIdArray = areaIdArray.concat(areaId);
    _.each(areaIdArray, function(areaItem) {
        var areaName = (HPGlobalParam.hpAreas&&HPGlobalParam.hpAreas[areaItem]&&HPGlobalParam.hpAreas[areaItem].get('title')) || '';
        areaNames.push(areaName);
    });

    return areaNames;
}

/**
 * 从装备ID获取装备名称
 * @param cateId
 * @returns {Array}
 */
exports.cateNameFromId = function(cateId) {
    var HPGlobalParam = AV.HPGlobalParam || {};
    var cateNames = [];
    var cateIdArray = [];

    cateIdArray = cateIdArray.concat(cateId);
    _.each(cateIdArray, function(cateItem) {
        var cateName = (HPGlobalParam.hpCates&&HPGlobalParam.hpCates[cateItem]&&HPGlobalParam.hpCates[cateItem].get('cate_name')) || '';
        cateNames.push(cateName);
    });

    return cateNames;
}

exports.getMountaineerClubActivityId = function() {
    if (this.isSahalaDevEnv()) {
        return '5563e261e4b032867898ce65';
    }

    return '5541c4f2e4b0e2a91580cfdc';
}

/**
 * 获取撒哈拉小助手账号（将来可能有多个）
 * @returns {*}
 */
exports.getSahalaAssistants = function() {
    if (this.isSahalaDevEnv()) {
        return ['555e9c98e4b0fa5c84c2c2b2'];
    }

    return ['5538afc9e4b0cafb0a1e8d6e'];
}

/**
 * 关注撒哈拉官方助手
 * @param userId
 */
exports.followSahalaAssistants = function(userId) {
    var sahalaObjs = [];
    var assistants = this.getSahalaAssistants();

    _.each(assistants, function(user){
        sahalaObjs.push(AV.User.createWithoutData('_User', user));
    });
    var query = new AV.Query('_Followee');
    query.equalTo('user', AV.User.createWithoutData('_User', userId));
    query.containedIn('followee', sahalaObjs);
    query.find().then(function(results){
        var followees = [];
        _.each(results, function(user){
            followees.push(user.get('followee').id);
        });

        //找到该用户还有哪些官方账号没有关注，然后关注之
        var unfollowees = _.difference(assistants, followees);
        _.each(unfollowees, function(assistantUserId){
            console.info('user %s follow sahala assistant %s', userId, assistantUserId);
            AV.User.current().follow(assistantUserId);
        });

    });
}

exports.getCityTag = function() {
    if (this.isSahalaDevEnv()) {
        return '54ca0f5de4b0f88531b6be8f';
    }

    return '54ca0f5de4b0f88531b6be8f';
}

/**
 * 判断用户是否在黑名单列表里面
 * @param userId    被判断的用户ID
 * @param cb        callback
 * @returns {AV.Promise}
 */
exports.isUserInBlackList = function(userId) {
    if (!userId) {
        return AV.Promise.as(false);
    }

    var query = new AV.Query('BlackList');
    query.equalTo('type', 'user');
    return query.first().then(function(blackObj){
        if (blackObj) {
            var blackIds = blackObj.get('blackIds');
            if (_.indexOf(blackIds, userId) >= 0) {
                return AV.Promise.as(true);
            }
        }

        return AV.Promise.error();
    }).catch(function(err){
        return AV.Promise.as(false);
    });
}

/*
    根据表名，获取对应的数据模型，该数据模型需要作为全局对象保存，否则会出现堆栈溢出，具体见：
    https://forum.leancloud.cn/t/maximum-call-stack-size-exceeded-ru-he-jie-jue/142
 */
exports.extendClass = function(className) {
    var ClassModel = AV.HPClassModel && AV.HPClassModel[className];
    if (ClassModel) {
        return ClassModel;
    }

    AV.HPClassModel = AV.HPClassModel || {};
    ClassModel = AV.Object.extend(className);
    AV.HPClassModel[className] = ClassModel;
    return ClassModel;
}

exports.findDynamicAndReturn = function(userId, currUser, dynamicType, query, res) {
    var pickActivityKeys = ['objectId','__type', 'title', "className", 'user_id'];
    var pickUserKeys = ['objectId','__type', 'nickname', 'username', 'icon', "className"];
    var pickUserKeys2 = ['objectId', 'nickname', 'username', 'icon', "className"];
    var msgIds;
    var dynamics = [];
    var activities = [];

    var getLatestLikesOfDynamic = this.getLatestLikesOfDynamic;
    var getCommentDynamicResult = this.getCommentDynamicResult;
    var tagNameFromId = this.tagNameFromId;
    var formatDynamic = this.formatDynamic;

    query.find().then(function(results){
        if (dynamicType == 'followeDynamic') {
            dynamics = [];
            msgIds = [];
            var i = 0;
            _.each(results, function(item){
                if (item.data.dynamicNews) {
                    dynamics.push(item.data.dynamicNews);
                    msgIds[i++] = item.messageId;

                    var activity = item.data.dynamicNews.get('activityId');
                    if (activity) {
                        activities.push(activity._toPointer());
                    }
                }
            });
        } else {
            dynamics = results;
            dynamics = _.reject(dynamics, function(val){
                return (val == undefined);
            });

            _.each(dynamics, function(item){
                var activity = item.get('activityId');
                if (activity) {
                    activities.push(activity._toPointer());
                }
            });
        }

        var promises = [];
        //find likes objects
        promises.push(getLatestLikesOfDynamic(currUser&&currUser.id, dynamics));
        promises.push(getCommentDynamicResult(currUser&&currUser.id, dynamics));

        if (!_.isEmpty(activities)) {
            //find activities for current user signup
            var query = new AV.Query('ActivityUser');
            query.select('activity_id');
            query.equalTo('user_id', currUser);
            query.containedIn('activity_id', activities);
            promises.push(query.find());
        } else {
            promises.push(Promise.as());
        }

        return Promise.when(promises);
    }).then(function(likeResult, commentResult, activityResult){
        var activityObj = {};
        _.each(activityResult, function(activityUser){
            var activity = activityUser.get('activity_id');
            if (activity) {
                activityObj[activity.id] = true;
            }
        });


        var retDynamic = [];
        var i = 0;
        _.each(dynamics, function(dynamic){
            formatDynamic(dynamic);

            var userOfDynamic = dynamic.get('user_id');
            var activity = dynamic.get('activityId');
            dynamic = dynamic._toFullJSON();
            if (userOfDynamic) {
                dynamic.user_id = _.pick(userOfDynamic._toFullJSON(), pickUserKeys);
            }
            if (activity) {
                dynamic.activityId = _.pick(activity._toFullJSON(), pickActivityKeys);
            }

            var likeUsers = likeResult&&likeResult[dynamic.objectId];
            //get isLike for current user
            var findMe = _.find(likeUsers, function(user){
                return user&&(user.id==currUser.id);
            });
            var isLike = findMe?true:false;

            //convert user to fulljson & pick selected keys
            var pickLikeUserKeys = ['nickname', 'icon'];
            var convertedUsers = [];
            //convert likeUsers
            _.each(likeUsers, function(user){
                if (user) {
                    convertedUsers.push({
                        objectId:user.id,
                        nickname:user.get('nickname')||'',
                        icon:user.get('icon')||''
                    });
                }
            });
            retDynamic.push({
                dynamic:dynamic,
                extra:{
                    isComment:(commentResult&&commentResult[dynamic.objectId])?true:false,
                    isLike:isLike,
                    tagNames:tagNameFromId(dynamic.tags),
                    messageId:msgIds?msgIds[i++]:undefined,
                    hasSignup:activity&&activityObj[activity.id]?true:false,
                    likeUsers:convertedUsers
                }
            });
        });

        if (dynamicType == 'search') {
            res.success({
                resDynamic:retDynamic
            });
        } else {
            res.success(retDynamic);
        }

    });
}

/*
    是否为线上报名
 */
exports.isOfflineSignup = function(signupType) {
    return (signupType==1);
}

/*
    获取活动描述URL
 */
exports.getActivityIntroUrl = function(activityId) {
    if (this.isSahalaDevEnv()) {
        return 'http://apidev.imsahala.com/activityIntro/'.concat(activityId);
    }

    return 'http://api.imsahala.com/activityIntro/'.concat(activityId);
}

/*
    七牛 *.qiniudn.com域名失效，将动态里面的域名替换为7qnct0.com1.z0.glb.clouddn.com
 */
exports.formatDynamic = function(dynamic) {
    var thumbs = dynamic.get('thumbs');
    if (_.isArray(thumbs) && thumbs.length>0) {
        for (var i in thumbs) {
            var image = thumbs[i];
            image = image.replace(/hoopeng.qiniudn.com/gi, '7qnct0.com1.z0.glb.clouddn.com');
            thumbs[i] = image;
        }

        dynamic.set('thumbs', thumbs);
    }
}

exports.formatActivity = function(activity) {
    var indexThumb = activity.get('index_thumb_image');
    if (indexThumb && indexThumb.length>0) {
        indexThumb = indexThumb.replace(/hoopeng.qiniudn.com/gi, '7qnct0.com1.z0.glb.clouddn.com');
        activity.set('index_thumb_image', indexThumb);
    }

    var thumbs = activity.get('thumb_images');
    if (_.isArray(thumbs) && thumbs.length>0) {
        for (var i in thumbs) {
            var image = thumbs[i];
            image = image.replace(/hoopeng.qiniudn.com/gi, '7qnct0.com1.z0.glb.clouddn.com');
            thumbs[i] = image;
        }

        activity.set('thumb_images', thumbs);
    }
}