var common = require('cloud/common.js');
var myutils = require('cloud/utils');
var querystring = require('querystring');

AV.Cloud.beforeSave('Activity', function(req, res){
    common.isUserInBlackList(req.user&&req.user.id).then(function(isInBlack){
        if (isInBlack) {
            res.error('您被禁止创建活动!');
        } else {
            res.success();
        }
    })
});

AV.Cloud.afterSave('Activity', function(request) {
    var ActivityObj = request.object;
    var ActivityId = ActivityObj.id;
    var activityName = ActivityObj.get('title');
    var userObj = ActivityObj.get('user_id');
    var urlPath = common.isSahalaDevEnv()?'http://apidev.imsahala.com/activity/':'http://api.imsahala.com/activity/';
    ActivityObj.set('share_url', urlPath.concat(ActivityId));
    ActivityObj.save();

    //将活动发布者，自动加入聊天群组
    AV.Cloud.run('imAddToGroup',{
        userid:userObj.id,
        groupid:common.activityGroupIdForRC(ActivityId),
        groupname:activityName
    });

    //创建融云聊天室，用于实时导航
    var rcParam = myutils.getRongCloudParam();
    console.info('imAddToChatRoom:rong cloud param:%s', JSON.stringify(rcParam));

    var body = {};
    var key = 'chatroom[' + common.naviGroupIdForRC(ActivityId) + ']';
    body[key] = activityName;
    //通过avcloud发送HTTP的post请求
    AV.Cloud.httpRequest({
        method: 'POST',
        url: 'https://api.cn.rong.io/chatroom/create.json',
        headers: {
            'App-Key': rcParam.appKey,
            'Nonce': rcParam.nonce,
            'Timestamp': rcParam.timestamp,
            'Signature': rcParam.signature
        },
        body: querystring.stringify(body),
        success: function(httpResponse) {
            console.info('create chatroom:rong cloud %s response is %s', key, httpResponse.text);
            if (httpResponse.data.code == 200)
                console.info('创建聊天室成功');
            else
                console.error('创建聊天室失败,code='+httpResponse.data.code);
        },
        error: function(httpResponse) {
            console.error('create chatroom failed,errCode:%d errMsg:%s', httpResponse.status, httpResponse.text);
        }
    });


});

AV.Cloud.afterUpdate('Activity', function(req){
   var Activity = req.object;

    var currentNum = Activity.get('current_num');
    console.info('current number is %d', currentNum);
});