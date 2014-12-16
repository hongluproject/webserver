/**
 * Created by fugang on 14/12/16.
 */

/**/
AV.Cloud.afterSave('_Followee', function(req) {
    //好友数加1
    var user = req.object.get('user');
    user.increment('friendCount');
    user.save();
});

AV.Cloud.afterDelete('_Followee', function(req) {
    //好友数加1
    var user = req.object.get('user');
    user.increment('friendCount', -1);
    user.save();
});