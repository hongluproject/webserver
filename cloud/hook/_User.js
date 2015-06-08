/**
 * Created by fugang on 15/3/6.
 */
var myutils = require('cloud/utils.js');
var common = require('cloud/common.js');
var _ = AV._;

AV.Cloud.afterUpdate('_User', function(req){
    var user = req.object;
    if (user) {
        var hasModified = false;
        if (user.has('icon')) {
            var icon = user.get('icon');
            if (_.isEmpty(icon)) {
                user.set('icon', 'http://hoopeng.qiniudn.com/tags/201506041422337736.jpg');
                hasModified = true;
            }
        }

        if (user.has('nickname')) {
            var nickname = user.get('nickname');
            if (_.isEmpty(nickname)) {
                var inviteId = user.get('invite_id');
                user.set('nickname', '行者'.concat(inviteId));
                hasModified = true;
            }
        }

        if (hasModified) {
            user.save();
        }
    }
});

/*  暂时屏蔽更新融云用户信息功能，可能导致出现‘Maximum call stack size exceeded’
AV.Cloud.afterUpdate('_User', function(request) {
    var userObj = request.object;
    var userIcon = userObj.get('icon');
    var nickName = userObj.get('nickname');

    if (userIcon || nickName) {
        var rcParam = myutils.getRongCloudParam();
        console.info("refreshUser:nonce:%d timestamp:%d singature:%s", rcParam.nonce, rcParam.timestamp, rcParam.signature);

        var bodyParam = {userId:userObj.id};
        if (userIcon) {
            bodyParam.portraitUri = userIcon;
        }
        if (nickName) {
            bodyParam.name = nickName;
        }
        console.info('refresh user request body:', bodyParam);
        
        //通过avcloud发送HTTP的post请求
        AV.Cloud.httpRequest({
            method: 'POST',
            url: 'https://api.cn.rong.io/user/refresh.json',
            headers: {
                'App-Key': rcParam.appKey,
                'Nonce': rcParam.nonce,
                'Timestamp': rcParam.timestamp,
                'Signature': rcParam.signature
            },
            body: bodyParam,
            success: function(httpResponse) {
                console.info('refreshRCUser:rongcloud response is '+httpResponse.text);
            },
            error: function(httpResponse) {
                var errmsg = 'Request failed with response code ' + httpResponse.status;
                console.error('refreshUser:'+errmsg);
            }
        });
    }
});
*/