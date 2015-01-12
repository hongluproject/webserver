/**
 * Created by fugang on 14/12/18.
 */

AV.Cloud.define('getStatus', function(req, res) {
    var userId = req.params.userId;
    if (!userId) {
        res.error('缺少用户信息！');
        return;
    }
    var limit = req.params.limit || 20;
    var maxId = req.params.maxId || 0;
    var returnUserItem = {	//消息流中发布者信息，可以保留返回的字段
        objectId:1,
        username:1,
        nickname:1,
        className:1,
        icon:1,
        __type:1
    };

    var queryMsgArray = ['newPost', 'newQuestion', 'addFriend',
        'newComment', 'newLike', 'addToClan', 'removeFromClan', 'sysMessage'];
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
            var friendList = [];
            for (var i in followees) {
                friendList.push(AV.User.createWithoutData('_User', followees[i].id));
            }
            var queryFriend = new AV.Query('_Followee');
            queryFriend.select('followee');
            queryFriend.equalTo('user', AV.User.createWithoutData('_User', findFriendId));
            queryFriend.containedIn('followee', friendList);
            queryFriend.find().then(function(results){
                for (var i in results) {
                    var myFollowee = results[i].get('followee');
                    if (myFollowee) {
                        friendStatus[myFollowee.id] = true;
                    }
                }

                //添加是否为好友字段
                for (var i in followees) {
                    if (friendStatus[followees[i].id]) {
                        followees[i].set('isFriend', true);
                    }
                }

                res.success(followees);
            });

        } else {
            console.dir(followees);
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
        }

        res.success(userReturn);
    });
});