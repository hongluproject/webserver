/**
 * Created by fugang on 14/12/18.
 */
var common = require('cloud/common.js');

AV.Cloud.define('getStatus', function(req, res) {
    var userId = req.params.userId;
    if (!userId) {
        res.error('缺少用户信息！');
        return;
    }
    var limit = req.params.limit || 20;
    var maxId = req.params.maxId || 0;
    //保留的user keys
    var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "__type"];
    //保留的clan keys
    var pickClanKeys = ['objectId','__type', 'title', "className"];
    //保留的activity keys
    var pcickActivityKeys = ['objectId','__type', 'title', "className"];

    var userObj = AV.User.createWithoutData('_User', userId);
    var queryOr = [];
    //query newLike addFriend newComment newLike
    var queryMsgArray1 = ['newLike', 'addFriend', 'newComment', 'refuseToJoinClan',
        'addToClan', 'removeFromClan', 'quitClan', 'joinActivity', 'reviewJoinClan'];
    var query1 = AV.Status.inboxQuery(userObj);
    query1.containedIn('messageType', queryMsgArray1);
    query1.notEqualTo('source', userObj);   //不包含自己发送的消息
    query1.equalTo('targetUser', userObj);   //目标用户是自己
    queryOr.push(query1);

    var queryMsgArray2 = ['newPost', 'sysMessage'];
    var query2 = AV.Status.inboxQuery(userObj);
    query2.containedIn('messageType', queryMsgArray2);
    query2.notEqualTo('source', userObj);   //不包含自己发送的消息
    queryOr.push(query2);

    var query = new AV.InboxQuery(AV.Status);
    query._owner = userObj;
    query._orQuery(queryOr);
    query.include('source', 'clan', 'activity');
    query.limit(limit);
    query.maxId(maxId);
    var date1 = new Date();
    var _ = AV._;
    query.find().then(function(results) {
        var date2 = new Date();
        console.info('query user status use time:%dms', date2.getTime()-date1.getTime());
        //去掉source中多余的信息，只保留APP需要的字段
        for (var i in results) {
            var postUser = results[i].get('source');
            if (postUser) {
                results[i].set('source', _.pick(postUser, pickUserKeys));
            }

            var clan = results[i].get('clan');
            if (clan) {
                results[i].set('clan', _.pick(clan, pickClanKeys));
            }

            var activity = results[i].get('activity');
            if (activity) {
                results[i].set('activity', _.pick(activity, pcickActivityKeys));
            }
        }

        res.success(results);
    }, function(err) {
        console.error(err);
        res.error(err);
    });

    /*
    var queryMsgArray = ['newPost', 'addFriend',
        'newComment', 'newLike', 'addToClan', 'removeFromClan', 'joinActivity', 'sysMessage'];
    //查询事件流，获取用户关注的所有动态
    var query = AV.Status.inboxQuery(AV.User.createWithoutData('_User', userId));
    query.include('source');
    query.containedIn('messageType', queryMsgArray);    //查询指定的消息类型
    query.notEqualTo('source', AV.User.createWithoutData('_User', userId));   //不包含自己发送的消息
    query.limit(limit);
    query.maxId(maxId);
    var date1 = new Date();
    query.find().then(function(results) {
        var date2 = new Date();
        console.info('query user status use time:%dms', date2.getTime()-date1.getTime());
        //去掉source中多余的信息，只保留APP需要的字段
        for (var i in results) {
            var postUser = results[i].get('source');

            for (var k in postUser) {
                if (returnUserItem[k] != 1) {
                    delete postUser[k];
                }
            }
        }

        res.success(results);
    });
    */

});

AV.Cloud.define('getFriendList', function(req, res) {
    var userId = req.params.userId;
    var limit = req.params.limit || 100;
    var skip = req.params.skip;
    var findFriendId = req.params.findFriendId;
    if (!userId) {
        res.error('缺少用户信息!');
        return;
    }

    var followees = [];
    var friendStatus = {};
    var query = new AV.Query('_Followee');
    query.equalTo('user', AV.User.createWithoutData('_User', userId));
    query.include('followee');
    query.select('followee');
    query.limit(limit);
    query.skip(skip);
    query.find().then(function(results) {

        for (var i in results) {
            var currUser = results[i].get('followee');
            if (!currUser) {
                continue;
            }
            var returnUser = AV.User.createWithoutData('_User', currUser.id);
            returnUser.set('nickname', currUser.get('nickname'));
            returnUser.set('icon', currUser.get('icon'));
            returnUser.set('clanids', currUser.get('clanids'));
            if (userId == findFriendId) {
                returnUser.set('isFriend', true);
            }

            followees.push(returnUser);
        }

        if (findFriendId && findFriendId!=userId) { //查询好友关系

            //查询用户列表与 findFriendId 的好友关系，返回 isFriend 字段
            common.addFriendShipForUsers(findFriendId, followees).then(function(followees){
                res.success(followees);
            });

        } else {
            res.success(followees);
        }

    });
});

AV.Cloud.define('getUserInfo', function(req,res){
    var userId = req.params.userId;
    var findFriendId = req.params.findFriendId;
    if (!userId || !findFriendId) {
        res.error('请传入用户信息！');
        return;
    }

    console.info('userId:%s findFriendId:%s', userId, findFriendId);

    var userReturn;
    //查找对应用户信息
    var queryUser = new AV.Query('_User');
    queryUser.get(userId).then(function(userResult){
        userReturn = userResult;

        if (userId == findFriendId) {
            return AV.Promise.as(0);
        } else {
            //查找是否为好友关系
            var queryFollowee = new AV.Query('_followee');
            queryFollowee.equalTo('user', AV.Object.createWithoutData('_User',findFriendId));
            queryFollowee.equalTo('followee', AV.Object.createWithoutData('_User',userId));
            return queryFollowee.count();
        }
    }).then(function(count){
        if (count > 0) {    //找到好友关系
            userReturn.set('isFriend', true);
        } else {
            userReturn.set('isFriend', false);
        }

        res.success(userReturn);
    });
});