/**
 * Created by fugang on 14/12/16.
 */
var utils = require('cloud/utils.js');
var common = require('cloud/common.js');

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