/**
 * Created by fugang on 14/12/11.
 */


/** 发布动态后，通知到所有关注我的人
 *
 */
AV.Cloud.afterSave('DynamicNews', function(request){
    var postUser = request.object.get('user_id');
    if (!postUser) {
        console.info("DynamicNews afterSave:user is null!");
        return;
    }
    //该用户发布动态数加1
    var messageType = 'newPost';
    var type = request.object.get('type');   //1:ask 2:dynamic
    switch (type) {
        case 1:
            messageType = 'newQuestion';
            postUser.increment('questionCount');
            break;
        case 2:
            messageType = 'newPost';
            postUser.increment('dynamicCount');
            break;
    }
    postUser.save();


    var DynamicObj = request.object;
    var DynamicObjId = DynamicObj.id;
    DynamicObj.set('share_url', 'https://hoopeng.avosapps.com/dynamic/' + DynamicObjId);
    DynamicObj.save();

    var queryUser = new AV.Query('_User');
    queryUser.select("nickname");
    queryUser.get(postUser.id, {
        success:function(userObj) {
            if (!userObj) {
                return;
            }
            var sourceNickName = userObj.get('nickname');
            var status = new AV.Status(null, '发布了动态！');
            status.data.source = postUser._toPointer();
            status.set('messageType', messageType);
            status.set('dynamicNews', request.object._toPointer());

            //再将此消息发送给所有我的关注者（粉丝），让他们可以看到我的动态
            AV.Status.sendStatusToFollowers(status).then(function(status){
                //发布状态成功，返回状态信息
                console.info("%s 发布动态给粉丝成功!", postUser.id);
                console.dir(status);
            }, function(err){
                //发布失败
                console.error("%s 发布动态给粉丝失败!", postUser.id);
                console.dir(err);
            });
        }
    })
});

/** 动态删除后，将对应的status也清除掉，该动态对应的事件流也会相应消失
 *
 */
AV.Cloud.afterDelete('DynamicNews', function(request) {
    var type = request.object.get('type');   //1:ask 2:dynamic
    var user = request.object.get('user_id');

    var query = new AV.Query('_Status');
    query.equalTo('dynamicNews', request.object._toPointer());
    query.equalTo('messageType', 'newPost');
    query.equalTo('source', user._toPointer());
    query.first().then(function(status){
        if (status && status.id) {
            var deleteStatus = new AV.Status();
            deleteStatus.id = status.id;
            deleteStatus.destroy(); //调用后，对应的inbox信息也将会清除

            console.info('destroy dynamic %s, status %s ok!', request.object.id, status.id);
            status.destroy();
        }
    });

    //用户发布动态数减1
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
