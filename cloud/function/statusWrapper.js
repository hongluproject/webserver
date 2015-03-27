/**
 * Created by fugang on 14/12/18.
 */
var common = require('cloud/common.js');

/** 查询消息流
 *  函数名：getStatus
 *  参数：
 *      limit、skip：查询返回条数和偏移
 *      maxId:当前查询最大ID
 *      messageType:查询消息类型，
 *          'dynamic'  动态相关消息
 *          'friend'    好友相关消息
 *          'clan'      部落相关消息
 *          'activity'  活动相关消息
 *          若不传，则返回以上所有消息
 *  返回：
 *      [
 *          {Status Class Object}
 *      ]
 *
 */
AV.Cloud.define('getStatus', function(req, res) {
    var userId = req.params.userId || (req.user?req.user.id:undefined);
    if (!userId) {
        res.error('缺少用户信息！');
        return;
    }
    var limit = req.params.limit || 20;
    var maxId = req.params.maxId || 0;
    var inboxType = req.params.messageType || 'default';  //dynamic friend clan activity

    //保留的user keys
    var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "__type"];
    //保留的clan keys
    var pickClanKeys = ['objectId','__type', 'title', "className"];
    //保留的activity keys
    var pcickActivityKeys = ['objectId','__type', 'title', "className"];

    var userObj = AV.User.createWithoutData('_User', userId);
    var query = AV.Status.inboxQuery(userObj, inboxType);
    query.notEqualTo('source', userObj);   //不包含自己发送的消息
    query.include('source', 'clan', 'activity', 'StatementAccount');
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
                postUser = postUser._toFullJSON();
                results[i].set('source', _.pick(postUser, pickUserKeys));
            }

            var clan = results[i].get('clan');
            if (clan) {
                clan = clan._toFullJSON();
                results[i].set('clan', _.pick(clan, pickClanKeys));
            }

            var activity = results[i].get('activity');
            if (activity) {
                activity = activity._toFullJSON();
                results[i].set('activity', _.pick(activity, pcickActivityKeys));
            }

            var dynamic = results[i].get('dynamicNews');
            if (dynamic) {
                dynamic = dynamic._toFullJSON();
                results[i].set('dynamicNews', dynamic);
            }
        }

        res.success(results);
    }, function(err) {
        console.error(err);
        res.error(err);
    });

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
            returnUser.set('nickname', currUser.get('nickname')||'');
            returnUser.set('icon', currUser.get('icon')||'');
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