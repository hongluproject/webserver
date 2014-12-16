/**
 * Created by fugang on 14/12/11.
 */


/** 发布动态后，通知到所有关注我的人
 *
 */
AV.Cloud.afterSave('DynamicNews', function(request){
    var postUser = request.object.get('user_id')._toPointer();
    if (!postUser) {
        console.info("DynamicNews afterSave:user is null!");
        return;
    }
    console.dir(postUser);

    var status = new AV.Status(null, '发布了动态！');
    status.data.source = postUser;
    status.set('messageType', 'newPost');
    status.set('dynamicNews', request.object._toPointer());
    //先将此消息也发一份给自己，便于首页动态里面，可以看到自己
    var user = AV.Object.extend('_User');
    var query = new AV.Query(user);
    query.equalTo('objectId', postUser.objectId);
    status.query = query;
    /*  不需要发送给自己，否则会看到两个相同的动态。
     status.send().then(function(status){
     //发送成功
     console.info("%s 发布动态给自己成功!", postUser.objectId);
     console.dir(status);
     }, function(err){
     //发送失败
     console.info("%s 发布动态给自己失败!", postUser.objectId);
     console.dir(err);
     });
     */

    //再将此消息发送给所有我的关注者（粉丝），让他们可以看到我的动态
    AV.Status.sendStatusToFollowers(status).then(function(status){
        //发布状态成功，返回状态信息
        console.info("%s 发布动态给粉丝成功!", postUser.objectId);
        console.dir(status);
    }, function(err){
        //发布失败
        console.error("%s 发布动态给粉丝失败!", postUser.objectId);
        console.dir(err);
    });

    //该用户发布动态数加1
    var type = request.object.get('type');   //1:ask 2:dynamic
    switch (type) {
        case 1:
            user.increment('questionCount');
            break;
        case 2:
            user.increment('dynamicCount');
            break;
    }
    user.save();
});

/** 动态删除后，将对应的status也清除掉，该动态对应的事件流也会相应消失
 *
 */
AV.Cloud.afterDelete('DynamicNews', function(request) {
    var query = new AV.Query('_Status');
    query.equalTo('dynamicNews', request.object.id);
    query.equalTo('messageType', 'newPost');
    query.equalTo('source', request.object.get('user_id')._toPointer());
    query.destroyAll();

    //用户发布动态数减1
    var type = request.object.get('type');   //1:ask 2:dynamic
    var user = AV.Object.extend('_User');
    user.id = request.object.get('user_id').id;
    switch(type) {
        case 1:
            user.increment('questionCount', -1);
            break;
        case 2:
            user.increment('dynamicCount', -1);
            break;
    }
    user.save();
});
