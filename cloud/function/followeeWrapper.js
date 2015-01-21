/**
 * Created by fugang on 15/1/16.
 */

AV.Cloud.define("unfollowFriend",function(req, res) {
    var myUserId = req.params.userId;
    var friendUserId = req.params.friendUserId;
    if (!myUserId || !friendUserId) {
        res.error('请输入用户信息！');
        return;
    }

    var myUserObj = AV.User.createWithoutData('_User', myUserId);
    myUserObj.unfollow(friendUserId).then(function(){
        //好友数减1
        myUserObj.increment('friendCount', -1);
        myUserObj.save();
        res.success();
    }, function(err){
        console.error('%s unfollow %s error:', myUserId, friendUserId, err);
        res.error(err);
    });

    /*
    var query = new AV.Query('_Followee');
    query.equalTo('user', AV.User.createWithoutData('_User', myUserId));
    query.equalTo('followee', AV.User.createWithoutData('_User', friendUserId));
    query.find().then(function(users) {
        if (!users || !users.length) {
            res.success();
            return;
        }

        //删除该记录
        AV.Object.destroyAll(users);

        //好友数减1
        var myUserObj = AV.User.createWithoutData('_User', myUserId);
        myUserObj.increment('friendCount', -1);
        myUserObj.save();
        res.success();
    });
    */
});