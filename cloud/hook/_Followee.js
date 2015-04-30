/**
 * Created by fugang on 14/12/16.
 */
var utils = require('cloud/utils.js');
var common = require('cloud/common.js');
var _ = AV._;

AV.Cloud.beforeSave('_Followee', function(req, res){
    if (!req.user || !req.user.id) {
        res.error('请登录账号!');
        return;
    }

    var followee = req.object.get('followee');
    var followeeId = followee && followee.id;

    if (followeeId) {
        var assistants = common.getSahalaAssistants();
        if (_.indexOf(assistants, followeeId) >= 0) {
            //若是关注官方助手，则将优先级设置为5，这样可以保障该用户的显示尽量靠前
            req.object.set('priority', 5);
        }
    }

    res.success();
});

/**/
AV.Cloud.afterSave('_Followee', function(req) {
    //好友数加1
    var user = req.object.get('user');
    user.fetchWhenSave(true);
    user.increment('friendCount');
    user.save();

    //告知 followee，user加他为好友
    var followee = req.object.get('followee');
    var query = new AV.Query('_User');
    query.equalTo('objectId', followee.id);
    common.sendStatus('addFriend', user, followee, query);
});

/** cannot enter this function, I don't know why  : by GaryFu
 *
AV.Cloud.afterDelete('_Followee', function(req) {
    console.info('afterDelete user:', req.user);
    //好友数加1
    var user = req.object.get('user');
    console.info('afterDelete _Followee ', user);
    user.increment('friendCount', -1);
    user.save();
});
 */