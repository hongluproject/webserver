/**
 * Created by gary on 14-9-28.
 */
var utils = require('cloud/utils.js');

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
        AV.HPGlobalParam = AV.HPGlobalParam || {};
        if (AV.HPGlobalParam.hpLevels && AV.HPGlobalParam.hpLevels[level]) {
            return AV.HPGlobalParam.hpLevels[level].get('maxClanUsers')||30;
        }

        switch (level) {
            case 1:
                return 30;
            case 2:
                return 50;
        }

        return 30;
    },

    getMaxCreateClan : function(level) {
        AV.HPGlobalParam = AV.HPGlobalParam || {};
        if (AV.HPGlobalParam.hpLevels && AV.HPGlobalParam.hpLevels[level]) {
            return AV.HPGlobalParam.hpLevels[level].get('maxCreateClan')||2;
        }

        switch (level) {
            case 1:
                return 2;
            case 2:
                return 5;
        }

        return 2;
    }
};

exports.getUserGrownWithLevel = function(level) {
    AV.HPGlobalParam = AV.HPGlobalParam || {};
    if (AV.HPGlobalParam.hpLevels) {
        return AV.HPGlobalParam.hpLevels[level];
    }

    return undefined;
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
        var likeClass = AV.Object.extend("Like");
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

exports.sendStatus = function(messageType, sourceUser, targetUser, query, extendProp) {
    var messageObj = {
        addFriend:"加你为好友！",
        removeFromClan:"从部落中移除！",
        newComment:"发表了评论！",
        newPost:"发布了动态！",
        newQuestion:'发布了提问！',
        newLike:"点赞了你！",
        addToClan:"加入了部落！",
        removeFromClan:'退出部落！',
        joinActivity:"加入了活动！",
        refuseToJoinClan  :"拒绝加入部落"
    };


    var status = new AV.Status(null, messageObj[messageType]);
    status.data.source = sourceUser._toPointer();
    status.query = query;
    status.set('messageType', messageType);
    if (targetUser) {
        status.set('targetUser', targetUser._toPointer());
    }

    status.set('messageSignature', utils.calcStatusSignature(sourceUser.id,messageType,new Date()));
    switch (messageType) {
        case 'newPost':
        case 'newComment':
        case 'newQuestion':
        case 'newLike':
            status.set('dynamicNews', extendProp.dynamicNews._toPointer());
            break;
        case 'addToClan':
        case 'removeFromClan':
            status.set('clan', extendProp.clan._toPointer());
            break;
    }
    if (messageType=='newPost' || messageType=='newQuestion') {
        //将此消息发送给所有我的关注者（粉丝），让他们可以看到我的动态
        AV.Status.sendStatusToFollowers(status).then(function(status){
            //发布状态成功，返回状态信息
            console.info("%s 发布动态给粉丝成功!", sourceUser.id);
            console.dir(status);
        }, function(err){
            //发布失败
            console.error("%s 发布动态给粉丝失败!", sourceUser.id);
            console.dir(err);
        });

    } else { //将消息发送到目标用户
        var emptyUser = false;
        if (!AV.User.current()) {
            process.domain._currentUser = sourceUser;
        }
        status.send().then(function(status){
            if (!AV.User.current()) {
                process.domain._currentUser=null;
            }
            console.info('%s 事件流发送成功', messageType);
        },function(error) {
            if (!AV.User.current()) {
                process.domain._currentUser=null;
            }
            console.error(error);
        });
        if (emptyUser) {
            AV.User._currentUser = null;
        }
    }
}