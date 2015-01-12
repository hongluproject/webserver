/**
 * Created by fugang on 14/12/16.
 */

/**/
AV.Cloud.afterSave('_Followee', function(req) {
    //好友数加1
    var user = req.object.get('user');
    user.increment('friendCount');
    user.save();

    //告知 followee，user加他为好友
    var followee = req.object.get('followee');
    var query = new AV.Query('_User');
    query.equalTo('objectId', followee.id);

    var status = new AV.Status(null, '加你为好友！');
    status.data.source = user._toPointer();
    status.query = query;
    status.set('messageType', 'addFriend');
    status.send().then(function(status){
        console.info('%s 加 %s好友关注事件流发送成功！', user.id, followee.id);
    },function(error) {
        console.error(error);
    });
});

AV.Cloud.afterDelete('_Followee', function(req) {
    //好友数加1
    var user = req.object.get('user');
    user.increment('friendCount', -1);
    user.save();
});